import { int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";
import type { MarketplaceCategory } from "../shared/marketplace";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type StoredOrderLine = {
  productId: string;
  title: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

export const orders = mysqlTable("orders", {
  reference: varchar("reference", { length: 40 }).primaryKey(),
  buyerUserId: int("buyerUserId"),
  buyerName: varchar("buyerName", { length: 120 }).notNull(),
  buyerPhone: varchar("buyerPhone", { length: 32 }).notNull(),
  deliveryAddress: text("deliveryAddress").notNull(),
  paymentMethod: mysqlEnum("paymentMethod", ["delivery", "paystack", "flutterwave"]).notNull(),
  paymentStatus: mysqlEnum("paymentStatus", ["pending", "paid", "cod_pending"]).notNull(),
  subtotal: int("subtotal").notNull(),
  referralDiscount: int("referralDiscount").notNull().default(0),
  deliveryFee: int("deliveryFee").notNull(),
  total: int("total").notNull(),
  referralCode: varchar("referralCode", { length: 32 }),
  discountType: mysqlEnum("discountType", ["none", "referral", "reward"]).notNull().default("none"),
  orderLines: json("orderLines").$type<StoredOrderLine[]>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const referralShares = mysqlTable("referralShares", {
  id: int("id").autoincrement().primaryKey(),
  sharerUserId: int("sharerUserId").notNull(),
  shareCode: varchar("shareCode", { length: 32 }).notNull().unique(),
  channel: mysqlEnum("channel", ["whatsapp", "tiktok", "instagram", "other"]).notNull(),
  status: mysqlEnum("status", ["shared", "qualified", "rewarded"]).notNull().default("shared"),
  rewardValue: int("rewardValue").notNull().default(500),
  rewardCode: varchar("rewardCode", { length: 32 }).unique(),
  rewardStatus: mysqlEnum("rewardStatus", ["none", "issued", "redeemed"]).notNull().default("none"),
  referredOrderReference: varchar("referredOrderReference", { length: 40 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const vendorApplications = mysqlTable("vendorApplications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  name: varchar("name", { length: 120 }).notNull(),
  storeName: varchar("storeName", { length: 160 }).notNull(),
  whatsapp: varchar("whatsapp", { length: 32 }).notNull(),
  category: mysqlEnum("category", ["Fashion", "Gadgets", "Beauty", "Home & Furniture", "Vehicles", "Animals & Pets"]).notNull(),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).notNull().default("pending"),
  commissionRate: int("commissionRate").notNull().default(12),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const vendorProducts = mysqlTable("vendorProducts", {
  id: int("id").autoincrement().primaryKey(),
  vendorApplicationId: int("vendorApplicationId").notNull(),
  title: varchar("title", { length: 180 }).notNull(),
  category: mysqlEnum("category", ["Fashion", "Gadgets", "Beauty", "Home & Furniture", "Vehicles", "Animals & Pets"]).$type<MarketplaceCategory>().notNull(),
  price: int("price").notNull(),
  description: text("description").notNull(),
  imageUrl: text("imageUrl"),
  imageUrls: json("imageUrls").$type<string[]>(),
  status: mysqlEnum("status", ["draft", "active", "rejected"]).notNull().default("draft"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;
export type ReferralShare = typeof referralShares.$inferSelect;
export type InsertReferralShare = typeof referralShares.$inferInsert;
export type VendorApplication = typeof vendorApplications.$inferSelect;
export type InsertVendorApplication = typeof vendorApplications.$inferInsert;
export type VendorProduct = typeof vendorProducts.$inferSelect;
export type InsertVendorProduct = typeof vendorProducts.$inferInsert;
