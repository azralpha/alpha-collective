import { decimal, int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";
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
  paymentMethod: mysqlEnum("paymentMethod", ["delivery", "paystack", "flutterwave", "wallet", "nowpayments"]).notNull(),
  paymentStatus: mysqlEnum("paymentStatus", ["pending", "paid", "cod_pending", "wallet_escrow", "wallet_released", "gateway_escrow", "gateway_released", "refunded"]).notNull(),
  fulfillmentStatus: mysqlEnum("fulfillmentStatus", ["pending", "delivered", "cancelled", "returned"]).notNull().default("pending"),
  subtotal: int("subtotal").notNull(),
  referralDiscount: int("referralDiscount").notNull().default(0),
  deliveryFee: int("deliveryFee").notNull(),
  total: int("total").notNull(),
  referralCode: varchar("referralCode", { length: 32 }),
  discountType: mysqlEnum("discountType", ["none", "referral", "reward"]).notNull().default("none"),
  orderLines: json("orderLines").$type<StoredOrderLine[]>().notNull(),
  deliveredAt: timestamp("deliveredAt"),
  buyerConfirmedAt: timestamp("buyerConfirmedAt"),
  returnedAt: timestamp("returnedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const referralShares = mysqlTable("referralShares", {
  id: int("id").autoincrement().primaryKey(),
  sharerUserId: int("sharerUserId").notNull(),
  shareCode: varchar("shareCode", { length: 32 }).notNull().unique(),
  channel: mysqlEnum("channel", ["whatsapp", "tiktok", "instagram", "other"]).notNull(),
  status: mysqlEnum("status", ["shared", "qualified", "rewarded", "voided"]).notNull().default("shared"),
  rewardValue: int("rewardValue").notNull().default(500),
  minimumOrderSubtotal: int("minimumOrderSubtotal").notNull().default(5000),
  rewardCode: varchar("rewardCode", { length: 32 }).unique(),
  rewardStatus: mysqlEnum("rewardStatus", ["none", "issued", "pending", "released", "redeemed", "cancelled", "voided"]).notNull().default("none"),
  referredOrderReference: varchar("referredOrderReference", { length: 40 }),
  referredUserId: int("referredUserId"),
  fraudStatus: mysqlEnum("fraudStatus", ["clear", "flagged"]).notNull().default("clear"),
  fraudReason: varchar("fraudReason", { length: 80 }),
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
  withdrawableBalance: int("withdrawableBalance").notNull().default(0),
  bonusBalance: int("bonusBalance").notNull().default(0),
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
  type: mysqlEnum("type", ["deposit", "withdrawal", "purchase_escrow", "bonus_purchase", "refund", "sale_earning", "reward_bonus"]).notNull(),
  direction: mysqlEnum("direction", ["in", "out"]).notNull(),
  status: mysqlEnum("status", ["pending", "completed", "held", "released", "failed", "reversed", "cancelled", "voided"]).notNull(),
  amount: int("amount").notNull(),
  balanceBucket: mysqlEnum("balanceBucket", ["withdrawable", "bonus"]).notNull().default("withdrawable"),
  balanceAfter: int("balanceAfter").notNull(),
  reference: varchar("reference", { length: 64 }).notNull(),
  idempotencyKey: varchar("idempotencyKey", { length: 120 }).notNull().unique(),
  orderReference: varchar("orderReference", { length: 40 }),
  description: varchar("description", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/** Policy values are administrator-managed and copied to a referral share when it is created. */
export const referralRewardSettings = mysqlTable("referralRewardSettings", {
  id: int("id").primaryKey(),
  minimumFirstOrderSubtotal: int("minimumFirstOrderSubtotal").notNull().default(5000),
  referralBonusAmount: int("referralBonusAmount").notNull().default(500),
  rewardReleaseScheduleTaskUid: varchar("rewardReleaseScheduleTaskUid", { length: 65 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Singleton configuration for the project-owned, publication-gated seven-day wallet escrow release schedule. */
export const escrowReleaseSettings = mysqlTable("escrowReleaseSettings", {
  id: int("id").primaryKey(),
  scheduleTaskUid: varchar("scheduleTaskUid", { length: 65 }).unique(),
  lastStartedAt: timestamp("lastStartedAt"),
  lastCompletedAt: timestamp("lastCompletedAt"),
  lastError: varchar("lastError", { length: 255 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Hash-only device and network signals. Raw IP and browser identifiers are never persisted. */
export const userSecuritySignals = mysqlTable("userSecuritySignals", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  deviceFingerprintHash: varchar("deviceFingerprintHash", { length: 128 }),
  ipHash: varchar("ipHash", { length: 128 }),
  firstSeenAt: timestamp("firstSeenAt").defaultNow().notNull(),
  lastSeenAt: timestamp("lastSeenAt").defaultNow().onUpdateNow().notNull(),
});

/** Immutable eligibility decision recorded for referral bonus fraud review. */
export const referralFraudChecks = mysqlTable("referralFraudChecks", {
  id: int("id").autoincrement().primaryKey(),
  referralShareId: int("referralShareId").notNull(),
  referredUserId: int("referredUserId").notNull(),
  status: mysqlEnum("status", ["clear", "flagged"]).notNull(),
  reason: mysqlEnum("reason", ["none", "same_device", "same_ip"]).notNull().default("none"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/** Pending post-sale bonuses; a schedule may release them only after the return window ends. */
export const bonusRewardHolds = mysqlTable("bonusRewardHolds", {
  id: int("id").autoincrement().primaryKey(),
  walletId: int("walletId").notNull(),
  userId: int("userId").notNull(),
  orderReference: varchar("orderReference", { length: 40 }).notNull(),
  referralShareId: int("referralShareId"),
  type: mysqlEnum("type", ["referral", "cashback", "review"]).notNull(),
  beneficiary: mysqlEnum("beneficiary", ["sharer", "referred", "customer"]).notNull(),
  amount: int("amount").notNull(),
  status: mysqlEnum("status", ["pending", "released", "cancelled", "voided"]).notNull().default("pending"),
  releaseAt: timestamp("releaseAt").notNull(),
  releasedAt: timestamp("releasedAt"),
  cancelledAt: timestamp("cancelledAt"),
  idempotencyKey: varchar("idempotencyKey", { length: 140 }).notNull().unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/** Idempotent non-withdrawable grants that are not tied to a buyer order reward hold. */
export const rewardGrants = mysqlTable("rewardGrants", {
  id: int("id").autoincrement().primaryKey(),
  walletId: int("walletId").notNull(),
  userId: int("userId").notNull(),
  type: mysqlEnum("type", ["kyc_completion", "vendor_dispatch", "vendor_leaderboard"]).notNull(),
  amount: int("amount").notNull(),
  status: mysqlEnum("status", ["pending", "released", "cancelled", "voided"]).notNull().default("pending"),
  sourceOrderReference: varchar("sourceOrderReference", { length: 40 }),
  rewardMonth: varchar("rewardMonth", { length: 7 }),
  releaseAt: timestamp("releaseAt"),
  releasedAt: timestamp("releasedAt"),
  cancelledAt: timestamp("cancelledAt"),
  idempotencyKey: varchar("idempotencyKey", { length: 140 }).notNull().unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/** One free-delivery redemption earned after qualifying calendar-month buyer spend. */
export const freeDeliveryVouchers = mysqlTable("freeDeliveryVouchers", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  earnedMonth: varchar("earnedMonth", { length: 7 }).notNull(),
  status: mysqlEnum("status", ["active", "redeemed", "cancelled", "expired"]).notNull().default("active"),
  earnedOrderReference: varchar("earnedOrderReference", { length: 40 }).notNull(),
  redeemedOrderReference: varchar("redeemedOrderReference", { length: 40 }),
  idempotencyKey: varchar("idempotencyKey", { length: 140 }).notNull().unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  redeemedAt: timestamp("redeemedAt"),
});

/** Public seller reward state, derived only from verified marketplace delivery events. */
export const vendorRewardProfiles = mysqlTable("vendorRewardProfiles", {
  id: int("id").autoincrement().primaryKey(),
  vendorUserId: int("vendorUserId").notNull().unique(),
  hasLightningSellerBadge: int("hasLightningSellerBadge").notNull().default(0),
  lightningBadgeAwardedAt: timestamp("lightningBadgeAwardedAt"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Verified logistics hand-over records; never inferred from a buyer claim. */
export const vendorDispatchEvents = mysqlTable("vendorDispatchEvents", {
  id: int("id").autoincrement().primaryKey(),
  orderReference: varchar("orderReference", { length: 40 }).notNull(),
  vendorUserId: int("vendorUserId").notNull(),
  dispatchedAt: timestamp("dispatchedAt").notNull(),
  onTime: int("onTime").notNull().default(0),
  idempotencyKey: varchar("idempotencyKey", { length: 140 }).notNull().unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/** Month-scoped zero-commission status for a qualifying approved vendor. */
export const vendorCommissionOverrides = mysqlTable("vendorCommissionOverrides", {
  id: int("id").autoincrement().primaryKey(),
  vendorUserId: int("vendorUserId").notNull(),
  rewardMonth: varchar("rewardMonth", { length: 7 }).notNull(),
  commissionRate: int("commissionRate").notNull().default(0),
  qualifyingDeliveries: int("qualifyingDeliveries").notNull(),
  idempotencyKey: varchar("idempotencyKey", { length: 140 }).notNull().unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

/** Project-owned recurring reward-job identifiers. Jobs are created only after publication. */
export const rewardsAutomationSettings = mysqlTable("rewardsAutomationSettings", {
  id: int("id").primaryKey(),
  monthlyVendorRewardsScheduleTaskUid: varchar("monthlyVendorRewardsScheduleTaskUid", { length: 65 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const escrowAllocations = mysqlTable("escrowAllocations", {
  id: int("id").autoincrement().primaryKey(),
  orderReference: varchar("orderReference", { length: 40 }).notNull(),
  buyerWalletId: int("buyerWalletId").notNull(),
  vendorUserId: int("vendorUserId").notNull(),
  grossAmount: int("grossAmount").notNull(),
  commissionAmount: int("commissionAmount").notNull(),
  netAmount: int("netAmount").notNull(),
  status: mysqlEnum("status", ["pending", "held", "released", "refunded"]).notNull().default("held"),
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
  provider: mysqlEnum("provider", ["paystack", "flutterwave"]).notNull().default("paystack"),
  amount: int("amount").notNull(),
  orderReference: varchar("orderReference", { length: 40 }),
  status: mysqlEnum("status", ["pending", "succeeded", "failed"]).notNull().default("pending"),
  providerTransactionId: varchar("providerTransactionId", { length: 64 }),
  paidAt: timestamp("paidAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Private NOWPayments quote and callback record. No client redirect or callback can credit a wallet without server verification. */
export const cryptoFundingAttempts = mysqlTable("cryptoFundingAttempts", {
  id: int("id").autoincrement().primaryKey(),
  walletId: int("walletId").notNull(),
  userId: int("userId").notNull(),
  reference: varchar("reference", { length: 64 }).notNull().unique(),
  amountNaira: int("amountNaira").notNull(),
  payCurrency: varchar("payCurrency", { length: 24 }).notNull(),
  providerPaymentId: varchar("providerPaymentId", { length: 80 }).unique(),
  quotedPayAmount: decimal("quotedPayAmount", { precision: 24, scale: 12 }),
  payAddress: text("payAddress"),
  orderReference: varchar("orderReference", { length: 40 }),
  quoteExpiresAt: timestamp("quoteExpiresAt").notNull(),
  status: mysqlEnum("status", ["pending", "confirmed", "failed", "expired"]).notNull().default("pending"),
  creditedAt: timestamp("creditedAt"),
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
  /** Null means the listing is not supplier-stock-managed; zero is explicitly sold out. */
  stockQuantity: int("stockQuantity"),
  inventorySyncedAt: timestamp("inventorySyncedAt"),
  inventorySyncStatus: mysqlEnum("inventorySyncStatus", ["not_managed", "current", "stale", "error"]).notNull().default("not_managed"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/** Strictly server/admin-only sourcing details for administrator-managed products. */
export const officialProductSourcing = mysqlTable("officialProductSourcing", {
  id: int("id").autoincrement().primaryKey(),
  officialProductId: int("officialProductId").notNull().unique(),
  fulfillmentProvider: mysqlEnum("fulfillmentProvider", ["local_vendor", "auto_fulfill_api", "manual_admin"]).notNull().default("manual_admin"),
  externalSkuId: varchar("externalSkuId", { length: 120 }),
  externalProductId: varchar("externalProductId", { length: 200 }),
  externalVariantId: varchar("externalVariantId", { length: 200 }),
  supplierCost: decimal("supplierCost", { precision: 12, scale: 2 }),
  supplierProductCost: decimal("supplierProductCost", { precision: 12, scale: 2 }),
  supplierShippingCost: decimal("supplierShippingCost", { precision: 12, scale: 2 }),
  supplierInventoryQuantity: int("supplierInventoryQuantity"),
  supplierInventoryCountryCode: varchar("supplierInventoryCountryCode", { length: 8 }),
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
  inventorySyncScheduleTaskUid: varchar("inventorySyncScheduleTaskUid", { length: 65 }).unique(),
  inventorySyncLastStartedAt: timestamp("inventorySyncLastStartedAt"),
  inventorySyncLastCompletedAt: timestamp("inventorySyncLastCompletedAt"),
  inventorySyncLastError: varchar("inventorySyncLastError", { length: 255 }),
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

/** Durable, administrator-owned CJ draft-import request. Never exposed to buyers or vendors. */
export const cjImportBatches = mysqlTable("cjImportBatches", {
  id: int("id").autoincrement().primaryKey(),
  requestedByUserId: int("requestedByUserId").notNull(),
  requestedSkuCount: int("requestedSkuCount").notNull(),
  processedSkuCount: int("processedSkuCount").notNull().default(0),
  succeededSkuCount: int("succeededSkuCount").notNull().default(0),
  failedSkuCount: int("failedSkuCount").notNull().default(0),
  markupPercent: decimal("markupPercent", { precision: 7, scale: 2 }).notNull(),
  exchangeRateNgnPerUsd: decimal("exchangeRateNgnPerUsd", { precision: 12, scale: 2 }).notNull(),
  category: mysqlEnum("category", ["Fashion", "Gadgets", "Beauty", "Home & Furniture", "Vehicles", "Animals & Pets"]).$type<MarketplaceCategory>().notNull(),
  destinationCountryCode: varchar("destinationCountryCode", { length: 8 }).notNull().default("NG"),
  status: mysqlEnum("status", ["queued", "processing", "completed", "completed_with_errors", "failed"]).notNull().default("queued"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
});

/** One idempotent work record for every normalized SKU in a CJ mass-import batch. */
export const cjImportBatchItems = mysqlTable("cjImportBatchItems", {
  id: int("id").autoincrement().primaryKey(),
  batchId: int("batchId").notNull(),
  submittedSku: varchar("submittedSku", { length: 120 }).notNull(),
  normalizedSku: varchar("normalizedSku", { length: 120 }).notNull(),
  status: mysqlEnum("status", ["queued", "processing", "imported", "skipped", "failed"]).notNull().default("queued"),
  officialProductId: int("officialProductId"),
  errorSummary: varchar("errorSummary", { length: 255 }),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
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
export type OfficialProduct = typeof officialProducts.$inferSelect;
export type InsertOfficialProduct = typeof officialProducts.$inferInsert;
export type OfficialProductSourcing = typeof officialProductSourcing.$inferSelect;
export type InsertOfficialProductSourcing = typeof officialProductSourcing.$inferInsert;
export type FulfilmentIntegration = typeof fulfilmentIntegrations.$inferSelect;
export type InsertFulfilmentIntegration = typeof fulfilmentIntegrations.$inferInsert;
export type FulfilmentJob = typeof fulfilmentJobs.$inferSelect;
export type InsertFulfilmentJob = typeof fulfilmentJobs.$inferInsert;
export type CjImportBatch = typeof cjImportBatches.$inferSelect;
export type InsertCjImportBatch = typeof cjImportBatches.$inferInsert;
export type CjImportBatchItem = typeof cjImportBatchItems.$inferSelect;
export type InsertCjImportBatchItem = typeof cjImportBatchItems.$inferInsert;
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
