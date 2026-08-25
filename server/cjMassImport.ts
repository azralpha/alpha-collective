import { and, eq, sql } from "drizzle-orm";
import { cjImportBatchItems, cjImportBatches, officialProductSourcing, officialProducts } from "../drizzle/schema";
import { MARKETPLACE_CATEGORIES, type MarketplaceCategory } from "../shared/marketplace";
import { CjDropshippingError, fetchCjProductForMassImport } from "./cjDropshipping";
import { createOfficialProduct, getDb } from "./db";
import { importCjProductImage, ProductImageProcessingError } from "./productImageProcessing";

export const MAX_CJ_MASS_IMPORT_SKUS = 50;

type BatchStatus = "queued" | "processing" | "completed" | "completed_with_errors" | "failed";

function requireDbForCjBatch() {
  return getDb().then(db => {
    if (!db) throw new Error("The marketplace database is not available.");
    return db;
  });
}

function affectedRows(result: unknown) {
  const header = Array.isArray(result) ? result[0] : result;
  return Number((header as { affectedRows?: number } | undefined)?.affectedRows ?? 0);
}

export function normalizeCjSkuList(value: string) {
  const normalized = Array.from(new Set(value.split(/[\n,]+/).map(sku => sku.trim().toUpperCase()).filter(Boolean)));
  if (!normalized.length) throw new CjDropshippingError("Paste at least one CJ SKU.", 400, false);
  if (normalized.length > MAX_CJ_MASS_IMPORT_SKUS) throw new CjDropshippingError(`Import up to ${MAX_CJ_MASS_IMPORT_SKUS} unique SKUs at a time.`, 400, false);
  if (normalized.some(sku => !/^[A-Z0-9_-]{3,120}$/.test(sku))) throw new CjDropshippingError("Each entry must be a valid CJ SKU, product ID, or SPU.", 400, false);
  return normalized;
}

export function calculateMassImportNairaPrice(input: { landedUsdCost: number; markupPercent: number; exchangeRateNgnPerUsd: number }) {
  const raw = input.landedUsdCost * input.exchangeRateNgnPerUsd * (1 + input.markupPercent / 100);
  if (!Number.isFinite(raw) || raw < 500 || raw > 5_000_000) throw new CjDropshippingError("The landed cost and pricing inputs produce an unsafe Naira price.", 422, false);
  return Math.ceil(raw / 50) * 50;
}

function summarizeBatch(batch: typeof cjImportBatches.$inferSelect, items: Array<{ id: number; submittedSku: string; status: string; officialProductId: number | null; errorSummary: string | null }>) {
  return {
    id: batch.id,
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

export async function createCjMassImportBatch(input: { requestedByUserId: number; skuText: string; markupPercent: number; exchangeRateNgnPerUsd: number; category: MarketplaceCategory }) {
  const skus = normalizeCjSkuList(input.skuText);
  if (!Number.isFinite(input.markupPercent) || input.markupPercent < 0 || input.markupPercent > 500) throw new CjDropshippingError("Enter a markup from 0% to 500%.", 400, false);
  if (!Number.isFinite(input.exchangeRateNgnPerUsd) || input.exchangeRateNgnPerUsd < 100 || input.exchangeRateNgnPerUsd > 10_000) throw new CjDropshippingError("Enter a realistic USD-to-Naira exchange rate.", 400, false);
  if (!MARKETPLACE_CATEGORIES.includes(input.category)) throw new CjDropshippingError("Select a valid marketplace category.", 400, false);

  const db = await requireDbForCjBatch();
  const id = await db.transaction(async tx => {
    const inserted = await tx.insert(cjImportBatches).values({ requestedByUserId: input.requestedByUserId, requestedSkuCount: skus.length, markupPercent: input.markupPercent.toFixed(2), exchangeRateNgnPerUsd: input.exchangeRateNgnPerUsd.toFixed(2), category: input.category, destinationCountryCode: "NG", status: "queued" });
    const batchId = Number(inserted[0].insertId);
    await tx.insert(cjImportBatchItems).values(skus.map(sku => ({ batchId, submittedSku: sku, normalizedSku: sku, status: "queued" as const })));
    return batchId;
  });
  return id;
}

export async function getCjMassImportBatch(batchId: number, requestedByUserId: number) {
  const db = await requireDbForCjBatch();
  const batch = (await db.select().from(cjImportBatches).where(and(eq(cjImportBatches.id, batchId), eq(cjImportBatches.requestedByUserId, requestedByUserId))).limit(1))[0];
  if (!batch) return null;
  const items = await db.select({ id: cjImportBatchItems.id, submittedSku: cjImportBatchItems.submittedSku, status: cjImportBatchItems.status, officialProductId: cjImportBatchItems.officialProductId, errorSummary: cjImportBatchItems.errorSummary }).from(cjImportBatchItems).where(eq(cjImportBatchItems.batchId, batchId)).orderBy(cjImportBatchItems.id);
  return summarizeBatch(batch, items);
}

async function claimBatchItem(batchId: number) {
  const db = await requireDbForCjBatch();
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
  const db = await requireDbForCjBatch();
  await db.transaction(async tx => {
    const update = await tx.update(cjImportBatchItems).set({ status: input.status, officialProductId: input.officialProductId ?? null, errorSummary: input.errorSummary?.slice(0, 255) ?? null, completedAt: new Date() }).where(and(eq(cjImportBatchItems.id, input.itemId), eq(cjImportBatchItems.status, "processing")));
    if (affectedRows(update) !== 1) return;
    await tx.update(cjImportBatches).set({ processedSkuCount: sql`${cjImportBatches.processedSkuCount} + 1`, succeededSkuCount: input.status === "imported" ? sql`${cjImportBatches.succeededSkuCount} + 1` : sql`${cjImportBatches.succeededSkuCount}`, failedSkuCount: input.status === "failed" ? sql`${cjImportBatches.failedSkuCount} + 1` : sql`${cjImportBatches.failedSkuCount}` }).where(eq(cjImportBatches.id, input.batchId));
    const batch = (await tx.select().from(cjImportBatches).where(eq(cjImportBatches.id, input.batchId)).limit(1))[0];
    if (batch && batch.processedSkuCount >= batch.requestedSkuCount) await tx.update(cjImportBatches).set({ status: batch.failedSkuCount > 0 ? "completed_with_errors" : "completed", completedAt: new Date() }).where(eq(cjImportBatches.id, input.batchId));
  });
}

function safeAdminImportError(error: unknown) {
  if (error instanceof CjDropshippingError || error instanceof ProductImageProcessingError) return error.message;
  return "This SKU could not be imported. Review it individually and try again.";
}

/** Processes one durable batch item. The UI safely calls this repeatedly while polling batch progress. */
export async function processNextCjMassImportItem(batchId: number, requestedByUserId: number) {
  const db = await requireDbForCjBatch();
  const batch = (await db.select().from(cjImportBatches).where(and(eq(cjImportBatches.id, batchId), eq(cjImportBatches.requestedByUserId, requestedByUserId))).limit(1))[0];
  if (!batch || !(["queued", "processing"] as BatchStatus[]).includes(batch.status)) return getCjMassImportBatch(batchId, requestedByUserId);
  const item = await claimBatchItem(batchId);
  if (!item) return getCjMassImportBatch(batchId, requestedByUserId);
  try {
    const existing = (await db.select({ id: officialProducts.id }).from(officialProducts).innerJoin(officialProductSourcing, eq(officialProductSourcing.officialProductId, officialProducts.id)).where(eq(officialProductSourcing.externalSkuId, item.normalizedSku)).limit(1))[0];
    if (existing) await finishBatchItem({ batchId, itemId: item.id, status: "skipped", officialProductId: existing.id, errorSummary: "This CJ SKU is already mapped to an official product." });
    else {
      const imported = await fetchCjProductForMassImport(item.normalizedSku, batch.destinationCountryCode);
      const resolvedExisting = (await db.select({ id: officialProducts.id }).from(officialProducts).innerJoin(officialProductSourcing, eq(officialProductSourcing.officialProductId, officialProducts.id)).where(eq(officialProductSourcing.externalSkuId, imported.sku)).limit(1))[0];
      if (resolvedExisting) await finishBatchItem({ batchId, itemId: item.id, status: "skipped", officialProductId: resolvedExisting.id, errorSummary: "This CJ variant is already mapped to an official product." });
      else {
        const imageUrls = await Promise.all(imported.imageUrls.map((imageUrl, index) => importCjProductImage({ imageUrl, storagePrefix: `official-products/${requestedByUserId}/cj-batch/${batchId}-${item.id}-${index}` }).then(result => result.url)));
        const price = calculateMassImportNairaPrice({ landedUsdCost: imported.supplierCost, markupPercent: Number(batch.markupPercent), exchangeRateNgnPerUsd: Number(batch.exchangeRateNgnPerUsd) });
        const officialProductId = await createOfficialProduct({ title: imported.title, category: batch.category, price, formerPrice: null, badge: "New arrival", description: imported.description, detail: imported.description, imageUrls, status: "draft", stockQuantity: imported.stockQuantity, inventorySyncStatus: "current", inventorySyncedAt: new Date(), sourcing: { fulfillmentProvider: "auto_fulfill_api", externalSkuId: imported.sku, externalProductId: imported.externalProductId, externalVariantId: imported.externalVariantId, supplierCost: imported.supplierCost.toFixed(2), supplierProductCost: imported.supplierProductCost.toFixed(2), supplierShippingCost: imported.supplierShippingCost.toFixed(2), supplierInventoryQuantity: imported.stockQuantity, supplierInventoryCountryCode: imported.inventoryCountryCode, supplierCurrency: "USD" } });
        await finishBatchItem({ batchId, itemId: item.id, status: "imported", officialProductId });
      }
    }
  } catch (error) {
    await finishBatchItem({ batchId, itemId: item.id, status: "failed", errorSummary: safeAdminImportError(error) });
  }
  return getCjMassImportBatch(batchId, requestedByUserId);
}
