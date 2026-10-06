import { and, eq, isNotNull } from "drizzle-orm";
import { officialProductSourcing, officialProducts } from "../drizzle/schema";
import { MARKETPLACE_CATEGORIES, type MarketplaceCategory } from "../shared/marketplace";
import { createOfficialProduct, getDb } from "./db";
import { importCjProductImage } from "./productImageProcessing";
import { tryGenerateGeminiProductEnhancement } from "./geminiProductEnhancer";
import { fetchSupplierProducts, type SupplierId } from "./supplierCatalog";

export const SUPPLIER_IMPORT_LIMITS = [10, 50, 100, 250, 500] as const;

function requireDb() { return getDb().then(db => { if (!db) throw new Error("The marketplace database is not available."); return db; }); }

function calculateNairaPrice(cost: number, markupPercent: number, exchangeRate: number, currency: "USD" | "NGN") {
  const raw = currency === "NGN" ? cost * (1 + markupPercent / 100) : cost * exchangeRate * (1 + markupPercent / 100);
  if (!Number.isFinite(raw) || raw < 500 || raw > 5_000_000) throw new Error("The supplier cost and pricing inputs produce an unsafe Naira price.");
  return Math.ceil(raw / 50) * 50;
}

export async function importSupplierDrafts(input: { requestedByUserId: number; supplier: SupplierId; skuText: string; limit: number; markupPercent: number; exchangeRateNgnPerUsd: number; category: MarketplaceCategory }) {
  if (!MARKETPLACE_CATEGORIES.includes(input.category)) throw new Error("Select a valid marketplace category.");
  const skus = Array.from(new Set(input.skuText.split(/[\n,]+/).map(value => value.trim().toUpperCase()).filter(Boolean)));
  const products = await fetchSupplierProducts({ supplier: input.supplier, skus, limit: input.limit });
  const db = await requireDb();
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];
  for (const product of products) {
    try {
      const existing = (await db.select({ id: officialProducts.id }).from(officialProducts).innerJoin(officialProductSourcing, eq(officialProductSourcing.officialProductId, officialProducts.id)).where(eq(officialProductSourcing.externalSkuId, product.sku)).limit(1))[0];
      if (existing) { skipped += 1; continue; }
      const imageUrls = await Promise.all(product.imageUrls.map((imageUrl, index) => importCjProductImage({ imageUrl, storagePrefix: `official-products/${input.requestedByUserId}/${input.supplier}/${Date.now()}-${index}` }).then(result => result.url)));
      const enhancement = await tryGenerateGeminiProductEnhancement({ title: product.title, description: product.description });
      const officialProductId = await createOfficialProduct({ title: enhancement?.cleanTitle ?? product.title, category: input.category, price: calculateNairaPrice(product.supplierCost, input.markupPercent, input.exchangeRateNgnPerUsd, product.supplierCurrency), formerPrice: null, badge: "New arrival", description: enhancement?.seoDescription ?? product.description, detail: enhancement?.seoDescription ?? product.description, aiCleanTitle: enhancement?.cleanTitle, aiSeoDescription: enhancement?.seoDescription, aiMetaDescription: enhancement?.metaDescription, aiSuggestedTags: enhancement?.suggestedTags, aiEnhancedAt: enhancement ? new Date() : null, imageUrls, status: "draft", stockQuantity: product.stockQuantity, inventorySyncStatus: product.inventoryKnown ? "current" : "stale", inventorySyncedAt: new Date(), sourcing: { fulfillmentProvider: "auto_fulfill_api", externalSkuId: product.sku, externalProductId: product.externalProductId, externalVariantId: product.externalVariantId, supplierCost: product.supplierCost.toFixed(2), supplierProductCost: product.supplierCost.toFixed(2), supplierShippingCost: "0.00", supplierInventoryQuantity: product.stockQuantity, supplierInventoryCountryCode: product.inventoryKnown ? "NG" : null, supplierCurrency: product.supplierCurrency } });
      if (officialProductId) imported += 1;
    } catch (error) { errors.push(`${product.sku}: ${error instanceof Error ? error.message : "import failed"}`); }
  }
  return { supplier: input.supplier, requested: products.length, imported, skipped, failed: errors.length, errors: errors.slice(0, 10) };
}

export async function syncAllSupplierApis() {
  const db = await requireDb();
  const rows = await db.select({ officialProductId: officialProducts.id, stockQuantity: officialProducts.stockQuantity, externalSkuId: officialProductSourcing.externalSkuId, supplier: officialProductSourcing.externalProductId }).from(officialProducts).innerJoin(officialProductSourcing, eq(officialProductSourcing.officialProductId, officialProducts.id)).where(and(eq(officialProductSourcing.fulfillmentProvider, "auto_fulfill_api"), isNotNull(officialProductSourcing.externalSkuId)));
  const results = { checked: 0, updated: 0, failed: 0, suppliers: {} as Record<string, { checked: number; updated: number; failed: number }> };
  for (const row of rows) {
    const supplier = (row.supplier?.split(":")[0] ?? "cj_dropshipping") as SupplierId;
    const stats = results.suppliers[supplier] ?? { checked: 0, updated: 0, failed: 0 };
    stats.checked += 1; results.checked += 1;
    try {
      const product = (await fetchSupplierProducts({ supplier, skus: [row.externalSkuId!], limit: 1 }))[0];
      if (!product) throw new Error("Product was not returned by the supplier.");
      await db.transaction(async tx => {
        await tx.update(officialProducts).set({ stockQuantity: product.stockQuantity, inventorySyncedAt: new Date(), inventorySyncStatus: product.inventoryKnown ? "current" : "stale" }).where(eq(officialProducts.id, row.officialProductId));
        await tx.update(officialProductSourcing).set({ supplierCost: product.supplierCost.toFixed(2), supplierProductCost: product.supplierCost.toFixed(2), supplierInventoryQuantity: product.stockQuantity, supplierInventoryCountryCode: product.inventoryKnown ? "NG" : null }).where(eq(officialProductSourcing.officialProductId, row.officialProductId));
      });
      stats.updated += 1; results.updated += 1;
    } catch { stats.failed += 1; results.failed += 1; await db.update(officialProducts).set({ inventorySyncStatus: "error" }).where(eq(officialProducts.id, row.officialProductId)); }
    results.suppliers[supplier] = stats;
  }
  return results;
}
