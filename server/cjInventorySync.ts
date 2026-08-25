import type { Express, Request, Response } from "express";
import { and, eq, isNotNull } from "drizzle-orm";
import { fulfilmentIntegrations, officialProducts, officialProductSourcing } from "../drizzle/schema";
import { fetchCjInventorySnapshot } from "./cjDropshipping";
import { getDb } from "./db";
import { sdk } from "./_core/sdk";

const MAX_SYNC_PRODUCTS = 50;
const SYNC_CONCURRENCY = 8;

async function requireDbForInventorySync() {
  const db = await getDb();
  if (!db) throw new Error("The marketplace database is not available.");
  return db;
}

async function syncOneOfficialProduct(input: { officialProductId: number; externalSkuId: string; externalVariantId: string | null }) {
  const snapshot = await fetchCjInventorySnapshot({ productSku: input.externalSkuId, preferredVariantId: input.externalVariantId });
  const db = await requireDbForInventorySync();
  await db.transaction(async tx => {
    await tx.update(officialProducts).set({ stockQuantity: snapshot.stockQuantity, inventorySyncedAt: new Date(), inventorySyncStatus: "current" }).where(eq(officialProducts.id, input.officialProductId));
    await tx.update(officialProductSourcing).set({ supplierInventoryQuantity: snapshot.stockQuantity, supplierInventoryCountryCode: snapshot.inventoryCountryCode, ...(snapshot.externalProductId ? { externalProductId: snapshot.externalProductId } : {}), ...(snapshot.externalVariantId ? { externalVariantId: snapshot.externalVariantId } : {}) }).where(eq(officialProductSourcing.officialProductId, input.officialProductId));
  });
}

/** Refreshes supplier-managed Alpha Collective stock snapshots only. It never reads customer records or creates orders. */
export async function syncCjOfficialInventory(taskUid: string) {
  const db = await requireDbForInventorySync();
  const integration = (await db.select().from(fulfilmentIntegrations).where(and(eq(fulfilmentIntegrations.provider, "cj_dropshipping"), eq(fulfilmentIntegrations.inventorySyncScheduleTaskUid, taskUid))).limit(1))[0];
  if (!integration) return { skipped: "orphan" as const, checked: 0, updated: 0, failed: 0 };
  await db.update(fulfilmentIntegrations).set({ inventorySyncLastStartedAt: new Date(), inventorySyncLastError: null }).where(eq(fulfilmentIntegrations.id, integration.id));
  const products = await db.select({ officialProductId: officialProducts.id, externalSkuId: officialProductSourcing.externalSkuId, externalVariantId: officialProductSourcing.externalVariantId }).from(officialProducts).innerJoin(officialProductSourcing, eq(officialProductSourcing.officialProductId, officialProducts.id)).where(and(eq(officialProductSourcing.fulfillmentProvider, "auto_fulfill_api"), isNotNull(officialProductSourcing.externalSkuId), isNotNull(officialProducts.stockQuantity))).limit(MAX_SYNC_PRODUCTS);
  let updated = 0;
  let failed = 0;
  for (let index = 0; index < products.length; index += SYNC_CONCURRENCY) {
    const group = products.slice(index, index + SYNC_CONCURRENCY);
    const results = await Promise.allSettled(group.map(async product => {
      await syncOneOfficialProduct({ officialProductId: product.officialProductId, externalSkuId: product.externalSkuId!, externalVariantId: product.externalVariantId });
    }));
    updated += results.filter(result => result.status === "fulfilled").length;
    failed += results.filter(result => result.status === "rejected").length;
  }
  await db.update(fulfilmentIntegrations).set({ inventorySyncLastCompletedAt: new Date(), inventorySyncLastError: failed ? `${failed} stock snapshot${failed === 1 ? "" : "s"} could not be refreshed.` : null }).where(eq(fulfilmentIntegrations.id, integration.id));
  return { checked: products.length, updated, failed };
}

/** This endpoint is inert until the project owner creates its 12-hour schedule after publication. */
export function registerCjInventorySyncSchedule(app: Express) {
  app.post("/api/scheduled/cj-inventory-sync", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
      return res.json({ ok: true, ...(await syncCjOfficialInventory(user.taskUid)) });
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : "CJ inventory synchronization failed", timestamp: new Date().toISOString() });
    }
  });
}
