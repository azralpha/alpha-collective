import { and, eq, isNotNull } from "drizzle-orm";
import { officialProductSourcing, officialProducts } from "../drizzle/schema";
import { getDb } from "./db";
import { fetchSupplierProductForImport, SUPPLIER_IDS, type SupplierId } from "./supplierCatalog";

function requireDb() { return getDb().then(db => { if (!db) throw new Error("The marketplace database is not available."); return db; }); }

export async function syncAllSupplierApis() {
  const db = await requireDb();
  const rows = await db.select({
    officialProductId: officialProducts.id,
    externalSkuId: officialProductSourcing.externalSkuId,
    externalProductId: officialProductSourcing.externalProductId,
  }).from(officialProducts)
    .innerJoin(officialProductSourcing, eq(officialProductSourcing.officialProductId, officialProducts.id))
    .where(and(eq(officialProductSourcing.fulfillmentProvider, "auto_fulfill_api"), isNotNull(officialProductSourcing.externalSkuId)));
  const results = { checked: 0, updated: 0, failed: 0, suppliers: {} as Record<string, { checked: number; updated: number; failed: number }> };
  for (const row of rows) {
    const supplierValue = row.externalProductId?.split(":")[0] ?? "";
    if (!(SUPPLIER_IDS as readonly string[]).includes(supplierValue)) continue;
    const supplier = supplierValue as SupplierId;
    const reference = supplier === "aliexpress"
      ? row.externalProductId!.slice("aliexpress:".length)
      : row.externalSkuId!;
    const stats = results.suppliers[supplier] ?? { checked: 0, updated: 0, failed: 0 };
    stats.checked += 1;
    results.checked += 1;
    try {
      const product = await fetchSupplierProductForImport(supplier, reference);
      await db.transaction(async tx => {
        await tx.update(officialProducts).set({
          stockQuantity: product.stockQuantity,
          inventorySyncedAt: new Date(),
          inventorySyncStatus: product.inventoryKnown ? "current" : "stale",
        }).where(eq(officialProducts.id, row.officialProductId));
        await tx.update(officialProductSourcing).set({
          externalVariantId: product.externalVariantId,
          supplierCost: product.supplierCost.toFixed(2),
          supplierProductCost: (product.supplierProductCost ?? product.supplierCost).toFixed(2),
          supplierShippingCost: (product.supplierShippingCost ?? 0).toFixed(2),
          supplierInventoryQuantity: product.stockQuantity,
          supplierInventoryCountryCode: product.inventoryKnown ? (product.inventoryCountryCode ?? "NG") : null,
          supplierCurrency: product.supplierCurrency,
        }).where(eq(officialProductSourcing.officialProductId, row.officialProductId));
      });
      stats.updated += 1;
      results.updated += 1;
    } catch {
      stats.failed += 1;
      results.failed += 1;
      await db.update(officialProducts).set({ inventorySyncStatus: "error" }).where(eq(officialProducts.id, row.officialProductId));
    }
    results.suppliers[supplier] = stats;
  }
  return results;
}
