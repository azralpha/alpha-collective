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
  vendorUserId?: number;
};

export const orders = mysqlTable("orders", {
  reference: varchar("reference", { length: 40 }).primaryKey(),
  buyerUserId: int("buyerUserId"),
  buyerName: varchar("buyerName", { length: 120 }).notNull(),
  buyerPhone: varchar("buyerPhone", { length: 32 }).notNull(),
  deliveryAddress: text("deliveryAddress").notNull(),
  paymentMethod: mysqlEnum("paymentMethod", ["delivery", "paystack", "flutterwave", "wallet"]).notNull(),
  paymentStatus: mysqlEnum("paymentStatus", ["pending", "paid", "cod_pending", "wallet_escrow", "wallet_released", "refunded"]).notNull(),
  fulfillmentStatus: mysqlEnum("fulfillmentStatus", ["pending", "delivered", "cancelled"]).notNull().default("pending"),
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

export const wallets = mysqlTable("wallets", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  availableBalance: int("availableBalance").notNull().default(0),
  escrowBalance: int("escrowBalance").notNull().default(0),
  pinHash: varchar("pinHash", { length: 255 }),
  pinFailedAttempts: int("pinFailedAttempts").notNull().default(0),
  pinLockedUntil: timestamp("pinLockedUntil"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const walletTransactions = mysqlTable("walletTransactions", {
  id: int("id").autoincrement().primaryKey(),
  walletId: int("walletId").notNull(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["deposit", "withdrawal", "purchase_escrow", "refund", "sale_earning"]).notNull(),
  direction: mysqlEnum("direction", ["in", "out"]).notNull(),
  status: mysqlEnum("status", ["pending", "completed", "held", "released", "failed", "reversed"]).notNull(),
  amount: int("amount").notNull(),
  balanceAfter: int("balanceAfter").notNull(),
  reference: varchar("reference", { length: 64 }).notNull(),
  idempotencyKey: varchar("idempotencyKey", { length: 120 }).notNull().unique(),
  orderReference: varchar("orderReference", { length: 40 }),
  description: varchar("description", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const escrowAllocations = mysqlTable("escrowAllocations", {
  id: int("id").autoincrement().primaryKey(),
  orderReference: varchar("orderReference", { length: 40 }).notNull(),
  buyerWalletId: int("buyerWalletId").notNull(),
  vendorUserId: int("vendorUserId").notNull(),
  grossAmount: int("grossAmount").notNull(),
  commissionAmount: int("commissionAmount").notNull(),
  netAmount: int("netAmount").notNull(),
  status: mysqlEnum("status", ["held", "released", "refunded"]).notNull().default("held"),
  releasedAt: timestamp("releasedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const withdrawalRequests = mysqlTable("withdrawalRequests", {
  id: int("id").autoincrement().primaryKey(),
  walletId: int("walletId").notNull(),
  userId: int("userId").notNull(),
  recipientId: int("recipientId"),
  amount: int("amount").notNull(),
  status: mysqlEnum("status", ["pending", "processing", "paid", "rejected", "failed", "reversed", "cancelled"]).notNull().default("pending"),
  transferReference: varchar("transferReference", { length: 64 }).unique(),
  providerReference: varchar("providerReference", { length: 64 }),
  providerTransferCode: varchar("providerTransferCode", { length: 64 }),
  reversedAt: timestamp("reversedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const walletBankRecipients = mysqlTable("walletBankRecipients", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  bankCode: varchar("bankCode", { length: 24 }).notNull(),
  bankName: varchar("bankName", { length: 120 }).notNull(),
  accountNumberMasked: varchar("accountNumberMasked", { length: 24 }).notNull(),
  accountName: varchar("accountName", { length: 160 }).notNull(),
  paystackRecipientCode: varchar("paystackRecipientCode", { length: 64 }).notNull(),
  kycBindingStatus: mysqlEnum("kycBindingStatus", ["unverified", "verified", "locked"]).notNull().default("unverified"),
  verifiedAt: timestamp("verifiedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const kycProfiles = mysqlTable("kycProfiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  status: mysqlEnum("status", ["not_started", "identity_pending", "identity_verified", "bank_pending", "verified", "rejected"]).notNull().default("not_started"),
  submittedLegalName: varchar("submittedLegalName", { length: 160 }),
  verifiedLegalName: varchar("verifiedLegalName", { length: 160 }),
  governmentIdImageUrl: text("governmentIdImageUrl"),
  smileJobId: varchar("smileJobId", { length: 120 }),
  failureReason: varchar("failureReason", { length: 255 }),
  identityVerifiedAt: timestamp("identityVerifiedAt"),
  bankVerifiedAt: timestamp("bankVerifiedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const withdrawalOtpChallenges = mysqlTable("withdrawalOtpChallenges", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  recipientId: int("recipientId").notNull(),
  amount: int("amount").notNull(),
  otpHash: varchar("otpHash", { length: 255 }).notNull(),
  status: mysqlEnum("status", ["pending_delivery", "delivered", "consumed", "expired", "failed", "locked"]).notNull().default("pending_delivery"),
  attempts: int("attempts").notNull().default(0),
  lockedUntil: timestamp("lockedUntil"),
  expiresAt: timestamp("expiresAt").notNull(),
  consumedAt: timestamp("consumedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const walletFundingAttempts = mysqlTable("walletFundingAttempts", {
  id: int("id").autoincrement().primaryKey(),
  walletId: int("walletId").notNull(),
  userId: int("userId").notNull(),
  reference: varchar("reference", { length: 64 }).notNull().unique(),
  amount: int("amount").notNull(),
  status: mysqlEnum("status", ["pending", "succeeded", "failed"]).notNull().default("pending"),
  providerTransactionId: varchar("providerTransactionId", { length: 64 }),
  paidAt: timestamp("paidAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
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

/** Public, administrator-managed catalogue items. No supplier fields are stored here. */
export const officialProducts = mysqlTable("officialProducts", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 180 }).notNull(),
  category: mysqlEnum("category", ["Fashion", "Gadgets", "Beauty", "Home & Furniture", "Vehicles", "Animals & Pets"]).$type<MarketplaceCategory>().notNull(),
  price: int("price").notNull(),
  formerPrice: int("formerPrice"),
  badge: varchar("badge", { length: 80 }),
  description: text("description").notNull(),
  detail: text("detail").notNull(),
  imageUrl: text("imageUrl"),
  imageUrls: json("imageUrls").$type<string[]>(),
  status: mysqlEnum("status", ["draft", "active", "rejected"]).notNull().default("draft"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Strictly server/admin-only sourcing details for administrator-managed products. */
export const officialProductSourcing = mysqlTable("officialProductSourcing", {
  id: int("id").autoincrement().primaryKey(),
  officialProductId: int("officialProductId").notNull().unique(),
  fulfillmentProvider: mysqlEnum("fulfillmentProvider", ["local_vendor", "auto_fulfill_api", "manual_admin"]).notNull().default("manual_admin"),
  externalSkuId: varchar("externalSkuId", { length: 120 }),
  supplierCost: int("supplierCost"),
  supplierCurrency: mysqlEnum("supplierCurrency", ["NGN", "USD"]).notNull().default("USD"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Provider configuration deliberately excludes secret keys, which remain server-only environment variables. */
export const fulfilmentIntegrations = mysqlTable("fulfilmentIntegrations", {
  id: int("id").autoincrement().primaryKey(),
  provider: mysqlEnum("provider", ["cj_dropshipping", "custom_webhook"]).notNull().unique(),
  enabled: int("enabled").notNull().default(0),
  apiBaseUrl: varchar("apiBaseUrl", { length: 500 }),
  callbackUrl: varchar("callbackUrl", { length: 500 }),
  defaultLogisticsName: varchar("defaultLogisticsName", { length: 80 }),
  defaultFromCountryCode: varchar("defaultFromCountryCode", { length: 8 }),
  orderMode: mysqlEnum("orderMode", ["create_only", "balance_payment"]).notNull().default("create_only"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Immutable, retry-safe server-side work queue for supplier order fulfilment. */
export const fulfilmentJobs = mysqlTable("fulfilmentJobs", {
  id: int("id").autoincrement().primaryKey(),
  orderReference: varchar("orderReference", { length: 40 }).notNull(),
  officialProductId: int("officialProductId").notNull(),
  provider: mysqlEnum("provider", ["cj_dropshipping", "custom_webhook"]).notNull(),
  status: mysqlEnum("status", ["queued", "processing", "submitted", "retry_pending", "manual_required", "skipped"]).notNull().default("queued"),
  externalSkuSnapshot: varchar("externalSkuSnapshot", { length: 120 }).notNull(),
  quantity: int("quantity").notNull(),
  deliverySnapshot: json("deliverySnapshot").$type<{ buyerName: string; buyerPhone: string; deliveryAddress: string; countryCode: "NG"; state: string; lga: string; streetDetails: string }>().notNull(),
  providerOrderId: varchar("providerOrderId", { length: 200 }),
  providerRequestId: varchar("providerRequestId", { length: 80 }),
  errorSummary: varchar("errorSummary", { length: 255 }),
  attemptCount: int("attemptCount").notNull().default(0),
  nextAttemptAt: timestamp("nextAttemptAt"),
  claimedAt: timestamp("claimedAt"),
  submittedAt: timestamp("submittedAt"),
  idempotencyKey: varchar("idempotencyKey", { length: 140 }).notNull().unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
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
export type OfficialProduct = typeof officialProducts.$inferSelect;
export type InsertOfficialProduct = typeof officialProducts.$inferInsert;
export type OfficialProductSourcing = typeof officialProductSourcing.$inferSelect;
export type InsertOfficialProductSourcing = typeof officialProductSourcing.$inferInsert;
export type FulfilmentIntegration = typeof fulfilmentIntegrations.$inferSelect;
export type InsertFulfilmentIntegration = typeof fulfilmentIntegrations.$inferInsert;
export type FulfilmentJob = typeof fulfilmentJobs.$inferSelect;
export type InsertFulfilmentJob = typeof fulfilmentJobs.$inferInsert;
export type Wallet = typeof wallets.$inferSelect;
export type InsertWallet = typeof wallets.$inferInsert;
export type WalletTransaction = typeof walletTransactions.$inferSelect;
export type InsertWalletTransaction = typeof walletTransactions.$inferInsert;
export type EscrowAllocation = typeof escrowAllocations.$inferSelect;
export type InsertEscrowAllocation = typeof escrowAllocations.$inferInsert;
export type WithdrawalRequest = typeof withdrawalRequests.$inferSelect;
export type InsertWithdrawalRequest = typeof withdrawalRequests.$inferInsert;
export type WalletBankRecipient = typeof walletBankRecipients.$inferSelect;
export type InsertWalletBankRecipient = typeof walletBankRecipients.$inferInsert;
export type KycProfile = typeof kycProfiles.$inferSelect;
export type InsertKycProfile = typeof kycProfiles.$inferInsert;
export type WithdrawalOtpChallenge = typeof withdrawalOtpChallenges.$inferSelect;
export type InsertWithdrawalOtpChallenge = typeof withdrawalOtpChallenges.$inferInsert;
export type WalletFundingAttempt = typeof walletFundingAttempts.$inferSelect;
export type InsertWalletFundingAttempt = typeof walletFundingAttempts.$inferInsert;
