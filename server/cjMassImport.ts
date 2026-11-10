import { and, eq, or, sql } from "drizzle-orm";
import { cjImportBatchItems, cjImportBatches, officialProductSourcing, officialProducts } from "../drizzle/schema";
import { MARKETPLACE_CATEGORIES, type MarketplaceCategory } from "../shared/marketplace";
import { AliExpressApiError } from "./aliexpressOpenPlatform";
import { CjDropshippingError } from "./cjDropshipping";
import { createOfficialProduct, getDb } from "./db";
import { importSupplierProductImage, ProductImageProcessingError } from "./productImageProcessing";
import { fetchSupplierCatalogRefs, fetchSupplierProductForImport, normalizeSupplierReference, SUPPLIER_IDS, type SupplierId } from "./supplierCatalog";

export const MAX_CJ_MASS_IMPORT_SKUS = 500;
export const MAX_SUPPLIER_MASS_IMPORT_PRODUCTS = 500;
type BatchStatus = "queued" | "processing" | "completed" | "completed_with_errors" | "failed";

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
}) {
  const supplier = input.supplier ?? "cj_dropshipping";
  if (!(SUPPLIER_IDS as readonly string[]).includes(supplier)) throw new Error("Choose CJ Dropshipping or AliExpress.");
  const limit = input.limit ?? MAX_SUPPLIER_MASS_IMPORT_PRODUCTS;
  if (!Number.isInteger(limit) || limit < 10 || limit > MAX_SUPPLIER_MASS_IMPORT_PRODUCTS) throw new Error("Choose an import limit between 10 and 500 products.");
  if (!Number.isFinite(input.markupPercent) || input.markupPercent < 0 || input.markupPercent > 500) throw new Error("Enter a markup from 0% to 500%.");
  if (!Number.isFinite(input.exchangeRateNgnPerUsd) || input.exchangeRateNgnPerUsd < 100 || input.exchangeRateNgnPerUsd > 10_000) throw new Error("Enter a realistic USD-to-Naira exchange rate.");
  if (!MARKETPLACE_CATEGORIES.includes(input.category)) throw new Error("Select a valid marketplace category.");

  const manual = Array.from(new Set(input.skuText.split(/[\n,]+/).map(value => value.trim()).filter(Boolean)));
  if (manual.length > limit) throw new Error(`Import up to ${limit} unique products in this batch.`);
  let refs = manual.length
    ? manual.map(value => ({ id: normalizeSupplierReference(supplier, value), previewImageUrl: null as string | null }))
    : await fetchSupplierCatalogRefs(supplier, limit);
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

async function claimBatchItem(batchId: number) {
  const db = await requireDbForBatch();
  return db.transaction(async tx => {
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
  let identity: string | null = null;
  let externalProductId = "";
  let productId = "";
  let externalSkuId = item.normalizedSku;
  try {
    const imported = await fetchSupplierProductForImport(supplier, item.normalizedSku, item.previewImageUrl);
    externalProductId = imported.externalProductId;
    externalSkuId = imported.sku;
    productId = imported.externalProductId.split(":").slice(1).join(":") || imported.sku;
    identity = createSupplierProductIdentity(supplier, imported.externalProductId);
    const existing = await findExistingSupplierProduct({ identity, externalProductId: imported.externalProductId, supplier, productId, sku: imported.sku });
    if (existing) {
      await finishBatchItem({ batchId, itemId: item.id, status: "skipped", officialProductId: existing.id, errorSummary: "This supplier product is already mapped to an official product." });
      return getCjMassImportBatch(batchId, requestedByUserId);
    }
    const imageUrls = await Promise.all(imported.imageUrls.map((imageUrl, index) => importSupplierProductImage({ supplier, imageUrl, storagePrefix: `official-products/${requestedByUserId}/${supplier}-batch/${batchId}-${item.id}-${index}` }).then(result => result.url)));
    const price = calculateMassImportNairaPrice({ landedUsdCost: imported.supplierCost, markupPercent: Number(batch.markupPercent), exchangeRateNgnPerUsd: Number(batch.exchangeRateNgnPerUsd), currency: imported.supplierCurrency });
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
    if (duplicate && error instanceof Error && /duplicate|unique|supplierIdentity|1062/i.test(error.message)) {
      await finishBatchItem({ batchId, itemId: item.id, status: "skipped", officialProductId: duplicate.id, errorSummary: "Another import already created this supplier product." });
      return getCjMassImportBatch(batchId, requestedByUserId);
    }
    await finishBatchItem({ batchId, itemId: item.id, status: "failed", errorSummary: safeAdminImportError(error) });
  }
  return getCjMassImportBatch(batchId, requestedByUserId);
}
