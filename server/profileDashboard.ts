import { and, desc, eq } from "drizzle-orm";
import {
  orders,
  userAchievements,
  userAddresses,
  userFollowedVendors,
  userLoyaltyProfiles,
  users,
  vendorApplications,
  vendorProducts,
} from "../drizzle/schema";
import { getDb, getWalletForUser } from "./db";
import { storagePut } from "./storage";

function requireDb() {
  return getDb().then(db => {
    if (!db) throw new Error("The marketplace database is not available.");
    return db;
  });
}

function cleanText(value: string | null | undefined, max: number) {
  return String(value ?? "").trim().replace(/[<>]/g, "").slice(0, max);
}

function validDateOfBirth(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`));
}

function loyaltyLevel(points: number) {
  if (points >= 2500) return { name: "Trailblazer", next: 5000 };
  if (points >= 1000) return { name: "Insider", next: 2500 };
  if (points >= 250) return { name: "Regular", next: 1000 };
  return { name: "Newcomer", next: 250 };
}

export async function getProfileDashboard(userId: number) {
  const db = await requireDb();
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new Error("User account was not found.");

  const [loyaltyRows, achievements, follows, userOrders, addresses, wallet, vendorApplication] = await Promise.all([
    db.select().from(userLoyaltyProfiles).where(eq(userLoyaltyProfiles.userId, userId)).limit(1),
    db.select().from(userAchievements).where(eq(userAchievements.userId, userId)).orderBy(desc(userAchievements.awardedAt)),
    db.select().from(userFollowedVendors).where(eq(userFollowedVendors.userId, userId)).orderBy(desc(userFollowedVendors.createdAt)),
    db.select().from(orders).where(eq(orders.buyerUserId, userId)).orderBy(desc(orders.createdAt)).limit(100),
    db.select().from(userAddresses).where(eq(userAddresses.userId, userId)).orderBy(desc(userAddresses.isDefault), desc(userAddresses.updatedAt)),
    getWalletForUser(userId),
    db.select().from(vendorApplications).where(eq(vendorApplications.userId, userId)).limit(1),
  ]);

  const points = loyaltyRows[0]?.points ?? 0;
  const level = loyaltyLevel(points);
  const ordersForAchievements = userOrders.length;
  const derivedAchievements = [
    ...(ordersForAchievements > 0 ? [{ achievementKey: "first_purchase", label: "First Purchase", description: "Completed your first Alpha Market order." }] : []),
    ...(vendorApplication[0]?.status === "approved" ? [{ achievementKey: "vendor_supporter", label: "Vendor Supporter", description: "Your account is an approved marketplace seller." }] : []),
    ...achievements.map(item => ({ achievementKey: item.achievementKey, label: item.label, description: item.description })),
  ].filter((item, index, list) => list.findIndex(other => other.achievementKey === item.achievementKey) === index);

  const followedSellers = [] as Array<{ vendorUserId: number; storeName: string; category: string; followedAt: Date; products: Array<{ id: number; title: string; price: number; imageUrl: string | null; status: string }> }>;
  for (const follow of follows) {
    const [vendor] = await db.select().from(vendorApplications).where(eq(vendorApplications.userId, follow.vendorUserId)).limit(1);
    if (!vendor) continue;
    const products = await db.select({ id: vendorProducts.id, title: vendorProducts.title, price: vendorProducts.price, imageUrl: vendorProducts.imageUrl, status: vendorProducts.status })
      .from(vendorProducts)
      .where(and(eq(vendorProducts.vendorApplicationId, vendor.id), eq(vendorProducts.status, "active")))
      .orderBy(desc(vendorProducts.createdAt))
      .limit(6);
    followedSellers.push({ vendorUserId: follow.vendorUserId, storeName: vendor.storeName, category: vendor.category, followedAt: follow.createdAt, products });
  }

  return {
    profile: {
      id: user.id,
      username: user.username ?? user.name ?? "Alpha Market member",
      name: user.name,
      profileImageUrl: user.profileImageUrl,
      email: user.email,
      phone: user.phone,
      legalName: user.legalName,
      dateOfBirth: user.dateOfBirth,
      legalIdentityLocked: Boolean(user.legalIdentityLockedAt),
      legalIdentityLockedAt: user.legalIdentityLockedAt,
      loginMethod: user.loginMethod,
    },
    loyalty: { points, level: level.name, nextLevelPoints: level.next, progressPercent: Math.min(100, Math.round((points / level.next) * 100)) },
    achievements: derivedAchievements,
    followedSellers,
    orders: userOrders,
    addresses,
    wallet: wallet ? { withdrawableBalance: wallet.withdrawableBalance, bonusBalance: wallet.bonusBalance, escrowBalance: wallet.escrowBalance } : null,
  };
}

export async function updateProfile(input: { userId: number; username?: string; phone?: string; legalName?: string; dateOfBirth?: string }) {
  const db = await requireDb();
  const [current] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
  if (!current) throw new Error("User account was not found.");

  const username = input.username === undefined ? undefined : cleanText(input.username, 80);
  const phone = input.phone === undefined ? undefined : cleanText(input.phone, 32);
  const hasLegalInput = input.legalName !== undefined || input.dateOfBirth !== undefined;
  if (hasLegalInput && current.legalIdentityLockedAt) throw new Error("Legal identity is already locked and cannot be changed.");

  const legalName = input.legalName === undefined ? current.legalName : cleanText(input.legalName, 160);
  const dateOfBirth = input.dateOfBirth === undefined ? current.dateOfBirth : cleanText(input.dateOfBirth, 10);
  const isLocking = Boolean(legalName || dateOfBirth);
  if (isLocking && (!legalName || !dateOfBirth || !validDateOfBirth(dateOfBirth))) {
    throw new Error("Enter your full legal name and a valid date of birth together. They will be locked after saving.");
  }

  await db.update(users).set({
    ...(username === undefined ? {} : { username: username || null }),
    ...(phone === undefined ? {} : { phone: phone || null }),
    ...(isLocking ? { legalName, dateOfBirth, legalIdentityLockedAt: new Date() } : {}),
  }).where(eq(users.id, input.userId));
  return getProfileDashboard(input.userId);
}

export async function uploadProfileAvatar(input: { userId: number; dataUrl: string }) {
  const match = input.dataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,([a-zA-Z0-9+/=]+)$/);
  if (!match) throw new Error("Upload a PNG, JPEG, or WebP profile image.");
  const data = Buffer.from(match[2], "base64");
  if (data.byteLength > 2 * 1024 * 1024) throw new Error("Profile images must be 2MB or smaller.");
  const uploaded = await storagePut(`profiles/${input.userId}/avatar.${match[1].split("/")[1]}`, data, match[1]);
  const db = await requireDb();
  await db.update(users).set({ profileImageUrl: uploaded.url }).where(eq(users.id, input.userId));
  return { profileImageUrl: uploaded.url };
}

export async function toggleFollowedVendor(input: { userId: number; vendorUserId: number }) {
  if (input.userId === input.vendorUserId) throw new Error("You cannot follow your own seller profile.");
  const db = await requireDb();
  const [vendor] = await db.select({ userId: vendorApplications.userId }).from(vendorApplications).where(and(eq(vendorApplications.userId, input.vendorUserId), eq(vendorApplications.status, "approved"))).limit(1);
  if (!vendor) throw new Error("That seller is not available to follow.");
  const [existing] = await db.select().from(userFollowedVendors).where(and(eq(userFollowedVendors.userId, input.userId), eq(userFollowedVendors.vendorUserId, input.vendorUserId))).limit(1);
  if (existing) {
    await db.delete(userFollowedVendors).where(eq(userFollowedVendors.id, existing.id));
    return { following: false };
  }
  await db.insert(userFollowedVendors).values({ userId: input.userId, vendorUserId: input.vendorUserId });
  return { following: true };
}

export async function saveAddress(input: { userId: number; id?: number; label: string; recipientName: string; phone: string; state: string; lga: string; streetDetails: string; isDefault?: boolean }) {
  const db = await requireDb();
  const values = { label: cleanText(input.label, 60) || "Home", recipientName: cleanText(input.recipientName, 120), phone: cleanText(input.phone, 32), country: "Nigeria", state: cleanText(input.state, 80), lga: cleanText(input.lga, 100), streetDetails: cleanText(input.streetDetails, 255), isDefault: input.isDefault ? 1 : 0 };
  if (!values.recipientName || !values.phone || !values.state || !values.lga || !values.streetDetails) throw new Error("Complete every address field before saving.");
  if (values.isDefault) await db.update(userAddresses).set({ isDefault: 0 }).where(eq(userAddresses.userId, input.userId));
  if (input.id) {
    const result = await db.update(userAddresses).set(values).where(and(eq(userAddresses.id, input.id), eq(userAddresses.userId, input.userId)));
    if ((result as any)[0]?.affectedRows === 0) throw new Error("Address was not found.");
  } else {
    const existing = await db.select({ id: userAddresses.id }).from(userAddresses).where(eq(userAddresses.userId, input.userId)).limit(1);
    await db.insert(userAddresses).values({ userId: input.userId, ...values, isDefault: input.isDefault || existing.length === 0 ? 1 : 0 });
  }
  return getProfileDashboard(input.userId);
}

export async function deleteAddress(input: { userId: number; id: number }) {
  const db = await requireDb();
  await db.delete(userAddresses).where(and(eq(userAddresses.id, input.id), eq(userAddresses.userId, input.userId)));
  return getProfileDashboard(input.userId);
}

export async function setDefaultAddress(input: { userId: number; id: number }) {
  const db = await requireDb();
  await db.update(userAddresses).set({ isDefault: 0 }).where(eq(userAddresses.userId, input.userId));
  await db.update(userAddresses).set({ isDefault: 1 }).where(and(eq(userAddresses.id, input.id), eq(userAddresses.userId, input.userId)));
  return getProfileDashboard(input.userId);
}
