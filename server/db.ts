import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  type InsertOrder,
  type InsertReferralShare,
  type InsertUser,
  type InsertVendorApplication,
  type InsertVendorProduct,
  orders,
  referralShares,
  users,
  vendorApplications,
  vendorProducts,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("The marketplace database is not available.");
  return db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;

  textFields.forEach(field => {
    if (user[field] !== undefined) {
      const value = user[field] ?? null;
      values[field] = value;
      updateSet[field] = value;
    }
  });

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }

  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  values.lastSignedIn ??= new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function createOrder(order: InsertOrder) {
  const db = await requireDb();
  await db.insert(orders).values(order);
  return order.reference;
}

export async function getReferralShareByCode(shareCode: string) {
  const db = await requireDb();
  const result = await db
    .select()
    .from(referralShares)
    .where(eq(referralShares.shareCode, shareCode.toUpperCase()))
    .limit(1);
  return result[0];
}

export async function getReferralShareByRewardCode(rewardCode: string) {
  const db = await requireDb();
  const result = await db
    .select()
    .from(referralShares)
    .where(eq(referralShares.rewardCode, rewardCode.toUpperCase()))
    .limit(1);
  return result[0];
}

export async function listReferralSharesForUser(userId: number) {
  const db = await requireDb();
  return db
    .select()
    .from(referralShares)
    .where(eq(referralShares.sharerUserId, userId))
    .orderBy(desc(referralShares.createdAt));
}

export async function createReferralShare(share: InsertReferralShare) {
  const db = await requireDb();
  await db.insert(referralShares).values(share);
  return share.shareCode;
}

export async function qualifyReferralShare(shareCode: string, reference: string, rewardCode: string) {
  const db = await requireDb();
  await db
    .update(referralShares)
    .set({ status: "qualified", referredOrderReference: reference, rewardCode, rewardStatus: "issued" })
    .where(and(eq(referralShares.shareCode, shareCode.toUpperCase()), eq(referralShares.status, "shared")));
}

export async function redeemReferralReward(rewardCode: string, userId: number) {
  const db = await requireDb();
  await db
    .update(referralShares)
    .set({ rewardStatus: "redeemed" })
    .where(
      and(
        eq(referralShares.rewardCode, rewardCode.toUpperCase()),
        eq(referralShares.sharerUserId, userId),
        eq(referralShares.rewardStatus, "issued"),
      ),
    );
}

export async function getVendorApplicationForUser(userId: number) {
  const db = await requireDb();
  const result = await db
    .select()
    .from(vendorApplications)
    .where(eq(vendorApplications.userId, userId))
    .limit(1);
  return result[0];
}

export async function createVendorApplication(application: InsertVendorApplication) {
  const db = await requireDb();
  const result = await db.insert(vendorApplications).values(application);
  return Number(result[0].insertId);
}

export async function listVendorProducts(vendorApplicationId: number) {
  const db = await requireDb();
  return db
    .select()
    .from(vendorProducts)
    .where(eq(vendorProducts.vendorApplicationId, vendorApplicationId))
    .orderBy(desc(vendorProducts.createdAt));
}

export async function listApprovedVendorProducts() {
  const db = await requireDb();
  return db
    .select({
      id: vendorProducts.id,
      title: vendorProducts.title,
      category: vendorProducts.category,
      price: vendorProducts.price,
      description: vendorProducts.description,
      imageUrl: vendorProducts.imageUrl,
      imageUrls: vendorProducts.imageUrls,
      vendor: vendorApplications.storeName,
    })
    .from(vendorProducts)
    .innerJoin(vendorApplications, eq(vendorProducts.vendorApplicationId, vendorApplications.id))
    .where(eq(vendorProducts.status, "active"))
    .orderBy(desc(vendorProducts.createdAt));
}

export async function listAdminReviewProducts() {
  const db = await requireDb();
  return db
    .select({
      id: vendorProducts.id,
      title: vendorProducts.title,
      category: vendorProducts.category,
      price: vendorProducts.price,
      description: vendorProducts.description,
      imageUrl: vendorProducts.imageUrl,
      imageUrls: vendorProducts.imageUrls,
      productStatus: vendorProducts.status,
      createdAt: vendorProducts.createdAt,
      vendorName: vendorApplications.name,
      storeName: vendorApplications.storeName,
      whatsapp: vendorApplications.whatsapp,
      applicationStatus: vendorApplications.status,
    })
    .from(vendorProducts)
    .innerJoin(vendorApplications, eq(vendorProducts.vendorApplicationId, vendorApplications.id))
    .orderBy(desc(vendorProducts.createdAt));
}

export async function createVendorProduct(product: InsertVendorProduct) {
  const db = await requireDb();
  const result = await db.insert(vendorProducts).values(product);
  return Number(result[0].insertId);
}

export async function updateVendorProductStatus(id: number, status: "draft" | "active" | "rejected") {
  const db = await requireDb();
  await db.update(vendorProducts).set({ status }).where(eq(vendorProducts.id, id));
}
