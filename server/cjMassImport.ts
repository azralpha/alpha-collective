import { and, eq, inArray, lt, or, sql } from "drizzle-orm";
import { cjImportBatchItems, cjImportBatches, officialProductSourcing, officialProducts } from "../drizzle/schema";
import { MARKETPLACE_CATEGORIES, type MarketplaceCategory } from "../shared/marketplace";
import { AliExpressApiError } from "./aliexpressOpenPlatform";
import { CjDropshippingError } from "./cjDropshipping";
import { createOfficialProduct, getDb, publishCjImportBatchDrafts } from "./db";
import { importSupplierProductImageGallery, ProductImageProcessingError } from "./productImageProcessing";
import { fetchSupplierCatalogRefs, fetchSupplierProductForImport, normalizeSupplierReference, SUPPLIER_IDS, type SupplierId } from "./supplierCatalog";
import { isR2ProductImageUrl, productImageStorageKey } from "./storage";

export const MAX_CJ_MASS_IMPORT_SKUS = 500;
export const MAX_SUPPLIER_MASS_IMPORT_PRODUCTS = 500;
export const CJ_MASS_IMPORT_CONCURRENCY = 1;
export const CJ_MASS_IMPORT_STALE_ITEM_RECOVERY_MS = 5 * 60 * 1000;
type BatchStatus = "queued" | "processing" | "completed" | "completed_with_errors" | "failed";

export function isStaleCjMassImportItem(startedAt: Date | null | undefined, now = Date.now()) {
  return startedAt instanceof Date && startedAt.getTime() < now - CJ_MASS_IMPORT_STALE_ITEM_RECOVERY_MS;
}

export function hasConfirmedPositiveSupplierInventory(inventoryKnown: boolean, stockQuantity: number | null) {
  return inventoryKnown && stockQuantity !== null && Number.isSafeInteger(stockQuantity) && stockQuantity > 0;
}

function requireDbForBatch() {
  return getDb().then(db => { if (!db) throw new Error("The marketplace database is not available."); return db; });
}

function affectedRows(result: unknown) {
  const header = Array.isArray(result) ? result[0] : result;
  return Number((header as { affectedRows?: number } | undefined)?.affectedRows ?? 0);
}

export function normalizeCjSkuList(value: string) {
  const normalized = Array.from(new Set(value.split(/[\n,]+/).map(sku => sku.trim().toUpperCase()).filter(Boolean)));
  if (!normalized.length) throw new CjDropshippingError("Paste at least one CJ SKU.", 400, false);
  if (normalized.length > MAX_SUPPLIER_MASS_IMPORT_PRODUCTS) throw new CjDropshippingError("Import up to 500 unique products at a time.", 400, false);
  if (normalized.some(sku => !/^[A-Z0-9_-]{3,120}$/.test(sku))) throw new CjDropshippingError("Each entry must be a valid CJ SKU, product ID, or SPU.", 400, false);
  return normalized;
}

export function calculateMassImportNairaPrice(input: { landedUsdCost: number; markupPercent: number; exchangeRateNgnPerUsd: number; currency?: "USD" | "NGN" }) {
  const raw = input.currency === "NGN"
    ? input.landedUsdCost * (1 + input.markupPercent / 100)
    : input.landedUsdCost * input.exchangeRateNgnPerUsd * (1 + input.markupPercent / 100);
  if (!Number.isFinite(raw) || raw < 500 || raw > 5_000_000) throw new Error("The supplier cost and pricing inputs produce an unsafe Naira price.");
  return Math.ceil(raw / 50) * 50;
}

export function createSupplierProductIdentity(supplier: SupplierId, externalProductId: string) {
  const productId = externalProductId.split(":").slice(1).join(":").trim();
  if (!productId) throw new Error("Supplier product identity is missing its external item ID.");
  return `${supplier}:${productId.toLowerCase()}`;
}

export function isRecoverableCjBatchDraft(input: {
  status: string;
  category: string;
  fulfillmentProvider: string | null;
  externalSkuId: string | null;
  externalProductId: string | null;
  externalVariantId: string | null;
  supplierIdentity: string | null;
  expected: { category: string; externalSkuId: string; externalProductId: string; externalVariantId: string | null; supplierIdentity: string };
  completeR2Gallery: boolean;
  imageKeys: Array<string | null>;
  imageKeyPrefix: string;
}) {
  return input.status === "draft"
    && input.category === input.expected.category
    && input.fulfillmentProvider === "auto_fulfill_api"
    && input.externalSkuId === input.expected.externalSkuId
    && input.externalProductId === input.expected.externalProductId
    && input.externalVariantId === input.expected.externalVariantId
    && input.supplierIdentity === input.expected.supplierIdentity
    && input.completeR2Gallery
    && input.imageKeys.length > 0
    && input.imageKeys.every(key => typeof key === "string" && key.startsWith(input.imageKeyPrefix));
}

function summarizeBatch(batch: typeof cjImportBatches.$inferSelect, items: Array<{ id: number; submittedSku: string; status: string; officialProductId: number | null; errorSummary: string | null }>) {
  return {
    id: batch.id,
    supplier: batch.supplierId,
    status: batch.status,
    requestedSkuCount: batch.requestedSkuCount,
    processedSkuCount: batch.processedSkuCount,
    succeededSkuCount: batch.succeededSkuCount,
    failedSkuCount: batch.failedSkuCount,
    markupPercent: Number(batch.markupPercent),
    exchangeRateNgnPerUsd: Number(batch.exchangeRateNgnPerUsd),
    items,
  };
}

export async function createCjMassImportBatch(input: {
  requestedByUserId: number;
  supplier?: SupplierId;
  skuText: string;
  limit?: number;
  markupPercent: number;
  exchangeRateNgnPerUsd: number;
  category: MarketplaceCategory;
  startPage?: number;
}) {
  const supplier = input.supplier ?? "cj_dropshipping";
  if (!(SUPPLIER_IDS as readonly string[]).includes(supplier)) throw new Error("Choose CJ Dropshipping or AliExpress.");
  const limit = input.limit ?? MAX_SUPPLIER_MASS_IMPORT_PRODUCTS;
  if (!Number.isInteger(limit) || limit < 10 || limit > MAX_SUPPLIER_MASS_IMPORT_PRODUCTS) throw new Error("Choose an import limit between 10 and 500 products.");
  if (!Number.isFinite(input.markupPercent) || input.markupPercent < 0 || input.markupPercent > 500) throw new Error("Enter a markup from 0% to 500%.");
  if (!Number.isFinite(input.exchangeRateNgnPerUsd) || input.exchangeRateNgnPerUsd < 100 || input.exchangeRateNgnPerUsd > 10_000) throw new Error("Enter a realistic USD-to-Naira exchange rate.");
  if (!MARKETPLACE_CATEGORIES.includes(input.category)) throw new Error("Select a valid marketplace category.");
  const startPage = input.startPage ?? 1;
  if (!Number.isInteger(startPage) || startPage < 1 || startPage > 9_991) throw new Error("Choose a CJ catalogue start page between 1 and 9,991.");

  const manual = Array.from(new Set(input.skuText.split(/[\n,]+/).map(value => value.trim()).filter(Boolean)));
  if (manual.length > limit) throw new Error(`Import up to ${limit} unique products in this batch.`);
  let refs = manual.length
    ? manual.map(value => ({ id: normalizeSupplierReference(supplier, value), previewImageUrl: null as string | null }))
    : await fetchSupplierCatalogRefs(supplier, limit, "", input.category, startPage);
  refs = Array.from(new Map(refs.map(ref => [ref.id, ref])).values()).slice(0, limit);
  if (!refs.length) throw new Error("The supplier returned no catalog products.");

  const db = await requireDbForBatch();
  const inserted = await db.transaction(async tx => {
    const result = await tx.insert(cjImportBatches).values({
      supplierId: supplier,
      requestedByUserId: input.requestedByUserId,
      requestedSkuCount: refs.length,
      markupPercent: input.markupPercent.toFixed(2),
      exchangeRateNgnPerUsd: input.exchangeRateNgnPerUsd.toFixed(2),
      category: input.category,
      destinationCountryCode: "NG",
      status: "queued",
    });
    const batchId = Number(result[0].insertId);
    await tx.insert(cjImportBatchItems).values(refs.map(ref => ({
      batchId,
      submittedSku: ref.id.slice(0, 120),
      normalizedSku: ref.id.slice(0, 120),
      previewImageUrl: ref.previewImageUrl,
      status: "queued" as const,
    })));
    return batchId;
  });
  return inserted;
}

export async function getCjMassImportBatch(batchId: number, requestedByUserId: number) {
  const db = await requireDbForBatch();
  const batch = (await db.select().from(cjImportBatches).where(and(eq(cjImportBatches.id, batchId), eq(cjImportBatches.requestedByUserId, requestedByUserId))).limit(1))[0];
  if (!batch) return null;
  const items = await db.select({ id: cjImportBatchItems.id, submittedSku: cjImportBatchItems.submittedSku, status: cjImportBatchItems.status, officialProductId: cjImportBatchItems.officialProductId, errorSummary: cjImportBatchItems.errorSummary }).from(cjImportBatchItems).where(eq(cjImportBatchItems.batchId, batchId)).orderBy(cjImportBatchItems.id);
  return summarizeBatch(batch, items);
}

async function isPublicR2ImageReachable(url: string) {
  if (!isR2ProductImageUrl(url)) return false;
  try {
    const response = await fetch(url, { method: "HEAD", redirect: "manual", signal: AbortSignal.timeout(10_000) });
    return response.ok && (response.headers.get("content-type") ?? "").toLowerCase().startsWith("image/");
  } catch {
    return false;
  }
}

async function mapWithConcurrency<T, R>(values: T[], concurrency: number, worker: (value: T) => Promise<R>) {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (nextIndex < values.length) {
      const index = nextIndex++;
      results[index] = await worker(values[index]);
    }
  }));
  return results;
}

/** Revalidates a completed CJ batch against current supplier stock, live cost, and reachable R2 galleries before publishing. */
export async function activateCjMassImportBatch(batchId: number, requestedByUserId: number) {
  const db = await requireDbForBatch();
  const batch = (await db.select().from(cjImportBatches).where(and(eq(cjImportBatches.id, batchId), eq(cjImportBatches.requestedByUserId, requestedByUserId))).limit(1))[0];
  if (!batch) return null;
  if (batch.supplierId !== "cj_dropshipping" || !["completed", "completed_with_errors"].includes(batch.status)) {
    throw new Error("Only completed CJ Dropshipping batches can be activated.");
  }
  const items = await db.select({ id: cjImportBatchItems.id, submittedSku: cjImportBatchItems.submittedSku, normalizedSku: cjImportBatchItems.normalizedSku, officialProductId: cjImportBatchItems.officialProductId })
    .from(cjImportBatchItems).where(and(eq(cjImportBatchItems.batchId, batchId), eq(cjImportBatchItems.status, "imported")));
  const productIds = items.flatMap(item => item.officialProductId ? [item.officialProductId] : []);
  if (!productIds.length) return { batchId, reviewed: 0, published: 0, skipped: 0, failures: [] as Array<{ sku: string; reason: string }> };
  const products = await db.select({
    id: officialProducts.id,
    status: officialProducts.status,
    title: officialProducts.title,
    price: officialProducts.price,
    imageUrl: officialProducts.imageUrl,
    imageUrls: officialProducts.imageUrls,
    stockQuantity: officialProducts.stockQuantity,
    fulfillmentProvider: officialProductSourcing.fulfillmentProvider,
    externalSkuId: officialProductSourcing.externalSkuId,
    externalProductId: officialProductSourcing.externalProductId,
    externalVariantId: officialProductSourcing.externalVariantId,
    supplierCost: officialProductSourcing.supplierCost,
    supplierCurrency: officialProductSourcing.supplierCurrency,
  }).from(officialProducts).innerJoin(officialProductSourcing, eq(officialProductSourcing.officialProductId, officialProducts.id))
    .where(inArray(officialProducts.id, productIds));
  const productById = new Map(products.map(product => [product.id, product]));
  const itemByProductId = new Map(items.flatMap(item => item.officialProductId ? [[item.officialProductId, item] as const] : []));
  const snapshots: Array<{ officialProductId: number; stockQuantity: number; inventoryCountryCode: string | null }> = [];
  const failures = await mapWithConcurrency(productIds, CJ_MASS_IMPORT_CONCURRENCY, async productId => {
    const product = productById.get(productId);
    const item = itemByProductId.get(productId);
    if (!product || !item) return { sku: String(productId), reason: "The imported product record could not be found." };
    if (product.status !== "draft") return { sku: item.submittedSku, reason: "The product is no longer an unpublished draft." };
    if (product.fulfillmentProvider !== "auto_fulfill_api" || !product.externalSkuId || !product.externalProductId) return { sku: item.submittedSku, reason: "CJ sourcing details are incomplete." };
    try {
      const current = await fetchSupplierProductForImport("cj_dropshipping", product.externalSkuId, null, batch.category as MarketplaceCategory);
      if (!hasConfirmedPositiveSupplierInventory(current.inventoryKnown, current.stockQuantity)) return { sku: item.submittedSku, reason: "CJ did not confirm positive current stock; the product remains a draft." };
      if (current.externalProductId !== product.externalProductId || current.externalVariantId !== product.externalVariantId) return { sku: item.submittedSku, reason: "CJ's currently selected product or variant differs from the imported listing; review and re-import it." };
      const price = calculateMassImportNairaPrice({ landedUsdCost: current.supplierCost, currency: current.supplierCurrency, markupPercent: Number(batch.markupPercent), exchangeRateNgnPerUsd: Number(batch.exchangeRateNgnPerUsd) });
      if (price !== product.price) return { sku: item.submittedSku, reason: "The current landed supplier cost changes the selected retail price; review and re-import this draft." };
      const images = Array.from(new Set([product.imageUrl, ...(product.imageUrls ?? [])].map(url => url?.trim()).filter((url): url is string => Boolean(url))));
      if (!images.length || images.length !== (product.imageUrls?.length ?? (product.imageUrl ? 1 : 0)) || images.some(url => !isR2ProductImageUrl(url))) return { sku: item.submittedSku, reason: "The complete product gallery is not stored on the configured R2 host." };
      const imageChecks = await Promise.all(images.map(isPublicR2ImageReachable));
      if (imageChecks.some(reachable => !reachable)) return { sku: item.submittedSku, reason: "One or more R2 gallery images are not publicly reachable as images." };
      snapshots.push({ officialProductId: product.id, stockQuantity: current.stockQuantity!, inventoryCountryCode: current.inventoryCountryCode ?? null });
      return null;
    } catch {
      return { sku: item.submittedSku, reason: "Live CJ stock, price, or image validation failed; the product remains a draft." };
    }
  });
  const published = snapshots.length ? await publishCjImportBatchDrafts({ batchId, requestedByUserId, inventorySnapshots: snapshots }) : 0;
  return { batchId, reviewed: productIds.length, published, skipped: productIds.length - published, failures: failures.filter((failure): failure is { sku: string; reason: string } => failure !== null) };
}

async function claimBatchItem(batchId: number) {
  const db = await requireDbForBatch();
  return db.transaction(async tx => {
    const staleCutoff = new Date(Date.now() - CJ_MASS_IMPORT_STALE_ITEM_RECOVERY_MS);
    const staleItem = (await tx.select().from(cjImportBatchItems).where(and(eq(cjImportBatchItems.batchId, batchId), eq(cjImportBatchItems.status, "processing"), lt(cjImportBatchItems.startedAt, staleCutoff))).orderBy(cjImportBatchItems.id).limit(1))[0];
    if (staleItem?.startedAt && isStaleCjMassImportItem(staleItem.startedAt)) {
      const reclaimed = await tx.update(cjImportBatchItems).set({ startedAt: new Date() }).where(and(eq(cjImportBatchItems.id, staleItem.id), eq(cjImportBatchItems.status, "processing"), eq(cjImportBatchItems.startedAt, staleItem.startedAt)));
      if (affectedRows(reclaimed) === 1) return staleItem;
    }
    const item = (await tx.select().from(cjImportBatchItems).where(and(eq(cjImportBatchItems.batchId, batchId), eq(cjImportBatchItems.status, "queued"))).orderBy(cjImportBatchItems.id).limit(1))[0];
    if (!item) return null;
    const claim = await tx.update(cjImportBatchItems).set({ status: "processing", startedAt: new Date() }).where(and(eq(cjImportBatchItems.id, item.id), eq(cjImportBatchItems.status, "queued")));
    if (affectedRows(claim) !== 1) return null;
    await tx.update(cjImportBatches).set({ status: "processing", startedAt: sql`coalesce(${cjImportBatches.startedAt}, now())` }).where(eq(cjImportBatches.id, batchId));
    return item;
  });
}

async function finishBatchItem(input: { batchId: number; itemId: number; status: "imported" | "skipped" | "failed"; officialProductId?: number; errorSummary?: string }) {
  const db = await requireDbForBatch();
  await db.transaction(async tx => {
    const update = await tx.update(cjImportBatchItems).set({ status: input.status, officialProductId: input.officialProductId ?? null, errorSummary: input.errorSummary?.slice(0, 255) ?? null, completedAt: new Date() }).where(and(eq(cjImportBatchItems.id, input.itemId), eq(cjImportBatchItems.status, "processing")));
    if (affectedRows(update) !== 1) return;
    await tx.update(cjImportBatches).set({
      processedSkuCount: sql`${cjImportBatches.processedSkuCount} + 1`,
      succeededSkuCount: input.status === "imported" ? sql`${cjImportBatches.succeededSkuCount} + 1` : sql`${cjImportBatches.succeededSkuCount}`,
      failedSkuCount: input.status === "failed" ? sql`${cjImportBatches.failedSkuCount} + 1` : sql`${cjImportBatches.failedSkuCount}`,
    }).where(eq(cjImportBatches.id, input.batchId));
    const batch = (await tx.select().from(cjImportBatches).where(eq(cjImportBatches.id, input.batchId)).limit(1))[0];
    if (batch && batch.processedSkuCount >= batch.requestedSkuCount) await tx.update(cjImportBatches).set({ status: batch.failedSkuCount > 0 ? "completed_with_errors" : "completed", completedAt: new Date() }).where(eq(cjImportBatches.id, input.batchId));
  });
}

async function findExistingSupplierProduct(input: { identity: string; externalProductId: string; supplier: SupplierId; productId: string; sku: string }) {
  const db = await requireDbForBatch();
  const supplierPrefix = `${input.supplier}:%`;
  const legacyCjProductId = input.supplier === "cj_dropshipping" ? eq(officialProductSourcing.externalProductId, input.productId) : undefined;
  return (await db.select({ id: officialProducts.id }).from(officialProducts)
    .innerJoin(officialProductSourcing, eq(officialProductSourcing.officialProductId, officialProducts.id))
    .where(or(
      eq(officialProductSourcing.supplierIdentity, input.identity),
      eq(officialProductSourcing.externalProductId, input.externalProductId),
      and(eq(officialProductSourcing.externalSkuId, input.sku), sql`${officialProductSourcing.externalProductId} LIKE ${supplierPrefix}`),
      legacyCjProductId,
    )).limit(1))[0];
}

async function isRecoverableBatchItemProduct(input: {
  officialProductId: number;
  expected: Parameters<typeof isRecoverableCjBatchDraft>[0]["expected"];
  imageKeyPrefix: string;
}) {
  const db = await requireDbForBatch();
  const product = (await db.select({
    status: officialProducts.status,
    category: officialProducts.category,
    imageUrls: officialProducts.imageUrls,
    fulfillmentProvider: officialProductSourcing.fulfillmentProvider,
    externalSkuId: officialProductSourcing.externalSkuId,
    externalProductId: officialProductSourcing.externalProductId,
    externalVariantId: officialProductSourcing.externalVariantId,
    supplierIdentity: officialProductSourcing.supplierIdentity,
  }).from(officialProducts)
    .innerJoin(officialProductSourcing, eq(officialProductSourcing.officialProductId, officialProducts.id))
    .where(eq(officialProducts.id, input.officialProductId)).limit(1))[0];
  if (!product) return false;
  const imageUrls = product.imageUrls ?? [];
  const imageKeys = imageUrls.map(productImageStorageKey);
  return isRecoverableCjBatchDraft({
    ...product,
    expected: input.expected,
    completeR2Gallery: imageUrls.length > 0 && imageUrls.every(isR2ProductImageUrl) && imageKeys.every(key => key !== null),
    imageKeys,
    imageKeyPrefix: input.imageKeyPrefix,
  });
}

async function finishExistingBatchProduct(input: {
  batchId: number;
  itemId: number;
  officialProductId: number;
  expected: Parameters<typeof isRecoverableCjBatchDraft>[0]["expected"];
  imageKeyPrefix: string;
}) {
  const recovered = await isRecoverableBatchItemProduct(input);
  await finishBatchItem({
    batchId: input.batchId,
    itemId: input.itemId,
    status: recovered ? "imported" : "skipped",
    officialProductId: input.officialProductId,
    errorSummary: recovered ? undefined : "This supplier product is already mapped to an official product.",
  });
  return recovered;
}

function safeAdminImportError(error: unknown) {
  if (error instanceof CjDropshippingError || error instanceof AliExpressApiError || error instanceof ProductImageProcessingError) return error.message;
  return "This supplier product could not be imported. Review it individually and try again.";
}

/** Processes one bounded catalog item; product creation remains an unpublished draft. */
export async function processNextCjMassImportItem(batchId: number, requestedByUserId: number) {
  const db = await requireDbForBatch();
  const batch = (await db.select().from(cjImportBatches).where(and(eq(cjImportBatches.id, batchId), eq(cjImportBatches.requestedByUserId, requestedByUserId))).limit(1))[0];
  if (!batch || !( ["queued", "processing"] as BatchStatus[]).includes(batch.status as BatchStatus)) return getCjMassImportBatch(batchId, requestedByUserId);
  const item = await claimBatchItem(batchId);
  if (!item) return getCjMassImportBatch(batchId, requestedByUserId);
  const supplier = (SUPPLIER_IDS as readonly string[]).includes(batch.supplierId) ? batch.supplierId as SupplierId : null;
  if (!supplier) {
    await finishBatchItem({ batchId, itemId: item.id, status: "failed", errorSummary: "This supplier is no longer supported." });
    return getCjMassImportBatch(batchId, requestedByUserId);
  }
  const imageStoragePrefix = `official-products/${requestedByUserId}/${supplier}-batch/${batchId}-${item.id}`;
  const imageKeyPrefix = `${imageStoragePrefix}-`;
  let identity: string | null = null;
  let externalProductId = "";
  let productId = "";
  let externalSkuId = item.normalizedSku;
  let externalVariantId: string | null = null;
  try {
    const imported = await fetchSupplierProductForImport(supplier, item.normalizedSku, item.previewImageUrl, batch.category as MarketplaceCategory);
    externalProductId = imported.externalProductId;
    externalSkuId = imported.sku;
    externalVariantId = imported.externalVariantId;
    if (!hasConfirmedPositiveSupplierInventory(imported.inventoryKnown, imported.stockQuantity)) {
      throw new CjDropshippingError("CJ stock could not be confirmed as available, so the product was not imported.", 422, false);
    }
    const price = calculateMassImportNairaPrice({ landedUsdCost: imported.supplierCost, markupPercent: Number(batch.markupPercent), exchangeRateNgnPerUsd: Number(batch.exchangeRateNgnPerUsd), currency: imported.supplierCurrency });
    productId = imported.externalProductId.split(":").slice(1).join(":") || imported.sku;
    identity = createSupplierProductIdentity(supplier, imported.externalProductId);
    const existing = await findExistingSupplierProduct({ identity, externalProductId: imported.externalProductId, supplier, productId, sku: imported.sku });
    if (existing) {
      await finishExistingBatchProduct({ batchId, itemId: item.id, officialProductId: existing.id, expected: { category: batch.category, externalSkuId: imported.sku, externalProductId: imported.externalProductId, externalVariantId: imported.externalVariantId, supplierIdentity: identity }, imageKeyPrefix });
      return getCjMassImportBatch(batchId, requestedByUserId);
    }
    const images = await importSupplierProductImageGallery({ supplier, imageUrls: imported.imageUrls, storagePrefix: imageStoragePrefix });
    const imageUrls = images.map(image => image.url);
    const officialProductId = await createOfficialProduct({
      title: imported.title,
      category: batch.category,
      price,
      formerPrice: null,
      badge: "New arrival",
      description: imported.description,
      detail: imported.description,
      imageUrls,
      status: "draft",
      stockQuantity: imported.stockQuantity,
      inventorySyncStatus: imported.inventoryKnown ? "current" : "stale",
      inventorySyncedAt: new Date(),
      sourcing: {
        fulfillmentProvider: "auto_fulfill_api",
        externalSkuId: imported.sku,
        externalProductId: imported.externalProductId,
        externalVariantId: imported.externalVariantId,
        supplierIdentity: identity,
        supplierCost: imported.supplierCost.toFixed(2),
        supplierProductCost: (imported.supplierProductCost ?? imported.supplierCost).toFixed(2),
        supplierShippingCost: (imported.supplierShippingCost ?? 0).toFixed(2),
        supplierInventoryQuantity: imported.inventoryKnown ? imported.stockQuantity : null,
        supplierInventoryCountryCode: imported.inventoryKnown ? (imported.inventoryCountryCode ?? "NG") : null,
        supplierCurrency: imported.supplierCurrency,
      },
    });
    await finishBatchItem({ batchId, itemId: item.id, status: "imported", officialProductId });
  } catch (error) {
    const duplicate = identity && productId ? await findExistingSupplierProduct({ identity, externalProductId, supplier, productId, sku: externalSkuId }).catch(() => null) : null;
    if (duplicate && identity && error instanceof Error && /duplicate|unique|supplierIdentity|1062/i.test(error.message)) {
      await finishExistingBatchProduct({ batchId, itemId: item.id, officialProductId: duplicate.id, expected: { category: batch.category, externalSkuId, externalProductId, externalVariantId, supplierIdentity: identity }, imageKeyPrefix });
      return getCjMassImportBatch(batchId, requestedByUserId);
    }
    await finishBatchItem({ batchId, itemId: item.id, status: "failed", errorSummary: safeAdminImportError(error) });
  }
  return getCjMassImportBatch(batchId, requestedByUserId);
}

/** Processes a small number of independently claimed items in parallel for responsive bulk imports. */
export async function processCjMassImportChunk(batchId: number, requestedByUserId: number) {
  await Promise.allSettled(Array.from({ length: CJ_MASS_IMPORT_CONCURRENCY }, () => processNextCjMassImportItem(batchId, requestedByUserId)));
  return getCjMassImportBatch(batchId, requestedByUserId);
}
