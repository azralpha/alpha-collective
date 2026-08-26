import { and, count, desc, eq, gte, isNull, like, lt, lte, ne, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { createPool, type Pool } from "mysql2";
import {
  type InsertOrder,
  type InsertReferralShare,
  type InsertUser,
  type InsertVendorApplication,
  type InsertVendorProduct,
  type InsertWalletTransaction,
  bonusRewardHolds,
  cjImportBatchItems,
  cjImportBatches,
  cryptoFundingAttempts,
  escrowAllocations,
  escrowReleaseSettings,
  freeDeliveryVouchers,
  kycProfiles,
  fulfilmentIntegrations,
  fulfilmentJobs,
  officialProducts,
  officialProductSourcing,
  orders,
  referralFraudChecks,
  referralRewardSettings,
  referralShares,
  rewardGrants,
  rewardsAutomationSettings,
  userSecuritySignals,
  users,
  vendorApplications,
  vendorCommissionOverrides,
  vendorDispatchEvents,
  vendorProducts,
  vendorRewardProfiles,
  walletBankRecipients,
  walletFundingAttempts,
  walletTransactions,
  wallets,
  withdrawalOtpChallenges,
  withdrawalRequests,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { hashSecuritySignal, normalizeDeviceId } from "./referralFraud";
import { splitWalletPayment } from "./walletBalanceSplit";
import { fundingCreditDisposition, withdrawalPaidDisposition, withdrawalRestoreDisposition } from "./walletReconciliation";
import type { MarketplaceCategory } from "../shared/marketplace";
import { parseDatabasePoolLimit } from "./performanceControls";

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: Pool | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const connectionLimit = parseDatabasePoolLimit(process.env.DATABASE_POOL_LIMIT);
      _pool = createPool({
        uri: process.env.DATABASE_URL,
        waitForConnections: true,
        connectionLimit,
        maxIdle: connectionLimit,
        idleTimeout: 60_000,
        queueLimit: 100,
        enableKeepAlive: true,
      });
      _db = drizzle({ client: _pool });
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _pool = null;
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
  const storedUser = await db.select({ id: users.id }).from(users).where(eq(users.openId, user.openId)).limit(1);
  if (storedUser[0]) {
    await db.insert(wallets).values({ userId: storedUser[0].id }).onDuplicateKeyUpdate({ set: { userId: sql`${wallets.userId}` } });
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function createOrder(order: InsertOrder, freeDeliveryVoucherId?: number) {
  const db = await requireDb();
  await db.transaction(async tx => {
    if (freeDeliveryVoucherId) {
      const claim = await tx.update(freeDeliveryVouchers).set({ status: "redeemed", redeemedAt: new Date(), redeemedOrderReference: order.reference }).where(and(eq(freeDeliveryVouchers.id, freeDeliveryVoucherId), eq(freeDeliveryVouchers.userId, order.buyerUserId ?? -1), eq(freeDeliveryVouchers.status, "active")));
      if (affectedRows(claim) !== 1) throw new Error("That free-delivery voucher is no longer available.");
    }
    await tx.insert(orders).values(order);
  });
  return order.reference;
}

export async function createPendingGatewayCheckout(input: {
  order: InsertOrder;
  walletId: number;
  provider: "paystack" | "flutterwave";
  paymentReference: string;
  allocations: Array<{ vendorUserId: number; grossAmount: number; commissionAmount: number; netAmount: number }>;
}) {
  const db = await requireDb();
  await db.transaction(async tx => {
    await tx.insert(orders).values(input.order);
    await tx.insert(walletFundingAttempts).values({ walletId: input.walletId, userId: input.order.buyerUserId ?? -1, reference: input.paymentReference, provider: input.provider, amount: input.order.total, orderReference: input.order.reference, status: "pending" });
    if (input.allocations.length) {
      await tx.insert(escrowAllocations).values(input.allocations.map(allocation => ({ orderReference: input.order.reference, buyerWalletId: input.walletId, vendorUserId: allocation.vendorUserId, grossAmount: allocation.grossAmount, commissionAmount: allocation.commissionAmount, netAmount: allocation.netAmount, status: "pending" as const })));
    }
  });
  return input.order.reference;
}

export const CASHBACK_RATE = 0.02;
export const FREE_DELIVERY_MONTHLY_THRESHOLD = 50_000;
export const KYC_COMPLETION_BONUS = 500;
export const LIGHTNING_SELLER_BONUS = 250;
export const LEADERBOARD_BONUSES = [5_000, 3_000, 2_000, 1_500, 1_000] as const;

export function rewardMonthKey(date = new Date()) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function rewardMonthRange(month = rewardMonthKey()) {
  const [year, rawMonth] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, (rawMonth ?? 1) - 1, 1));
  const end = new Date(Date.UTC(year, rawMonth ?? 1, 1));
  return { start, end };
}

export async function getWalletForUser(userId: number) {
  const db = await requireDb();
  const result = await db.select().from(wallets).where(eq(wallets.userId, userId)).limit(1);
  return result[0];
}

export async function ensureWalletForUser(userId: number) {
  const db = await requireDb();
  await db.insert(wallets).values({ userId }).onDuplicateKeyUpdate({ set: { userId: sql`${wallets.userId}` } });
  const wallet = await getWalletForUser(userId);
  if (!wallet) throw new Error("Wallet provisioning failed.");
  return wallet;
}

export async function listWalletTransactionsForUser(userId: number) {
  const db = await requireDb();
  return db.select().from(walletTransactions).where(eq(walletTransactions.userId, userId)).orderBy(desc(walletTransactions.createdAt), desc(walletTransactions.id));
}

export async function listPendingBonusRewardsForUser(userId: number) {
  const db = await requireDb();
  return db.select().from(bonusRewardHolds).where(and(eq(bonusRewardHolds.userId, userId), eq(bonusRewardHolds.status, "pending"))).orderBy(bonusRewardHolds.releaseAt);
}

export async function getWalletBankRecipientForUser(userId: number) {
  const db = await requireDb();
  const result = await db.select().from(walletBankRecipients).where(eq(walletBankRecipients.userId, userId)).limit(1);
  return result[0];
}

export async function getKycProfileForUser(userId: number) {
  const db = await requireDb();
  const result = await db.select().from(kycProfiles).where(eq(kycProfiles.userId, userId)).limit(1);
  return result[0];
}

export async function ensureKycProfileForUser(userId: number) {
  const db = await requireDb();
  await db.insert(kycProfiles).values({ userId }).onDuplicateKeyUpdate({ set: { userId: sql`${kycProfiles.userId}` } });
  const profile = await getKycProfileForUser(userId);
  if (!profile) throw new Error("KYC profile provisioning failed.");
  return profile;
}

export async function submitKycGovernmentId(input: { userId: number; submittedLegalName: string; governmentIdImageUrl: string }) {
  const db = await requireDb();
  await db.insert(kycProfiles).values({
    userId: input.userId,
    submittedLegalName: input.submittedLegalName,
    governmentIdImageUrl: input.governmentIdImageUrl,
    status: "identity_pending",
    failureReason: null,
  }).onDuplicateKeyUpdate({ set: {
    submittedLegalName: input.submittedLegalName,
    governmentIdImageUrl: input.governmentIdImageUrl,
    status: "identity_pending",
    failureReason: null,
    verifiedLegalName: null,
    identityVerifiedAt: null,
    bankVerifiedAt: null,
  } });
  return getKycProfileForUser(input.userId);
}

export async function lockKycVerifiedBankRecipient(input: { userId: number; recipientId: number; verifiedLegalName: string }) {
  const db = await requireDb();
  return db.transaction(async tx => {
    await tx.update(walletBankRecipients).set({ kycBindingStatus: "locked" }).where(and(eq(walletBankRecipients.id, input.recipientId), eq(walletBankRecipients.userId, input.userId)));
    await tx.update(kycProfiles).set({ status: "verified", verifiedLegalName: input.verifiedLegalName, identityVerifiedAt: new Date(), bankVerifiedAt: new Date(), failureReason: null }).where(eq(kycProfiles.userId, input.userId));
  });
}

export async function saveWalletBankRecipient(input: {
  userId: number;
  bankCode: string;
  bankName: string;
  accountNumberMasked: string;
  accountName: string;
  paystackRecipientCode: string;
}) {
  const db = await requireDb();
  const existing = await getWalletBankRecipientForUser(input.userId);
  if (existing?.kycBindingStatus === "locked") throw new Error("KYC_LOCKED_BANK_RECIPIENT");
  await db.insert(walletBankRecipients).values(input).onDuplicateKeyUpdate({ set: {
    bankCode: input.bankCode,
    bankName: input.bankName,
    accountNumberMasked: input.accountNumberMasked,
    accountName: input.accountName,
    paystackRecipientCode: input.paystackRecipientCode,
    kycBindingStatus: "unverified",
    verifiedAt: new Date(),
  } });
}

export async function createWithdrawalOtpChallenge(input: { userId: number; recipientId: number; amount: number; otpHash: string; expiresAt: Date }) {
  const db = await requireDb();
  const result = await db.insert(withdrawalOtpChallenges).values({ ...input, status: "pending_delivery" });
  return Number(result[0].insertId);
}

export async function markWithdrawalOtpChallengeDelivered(id: number) {
  const db = await requireDb();
  await db.update(withdrawalOtpChallenges).set({ status: "delivered" }).where(and(eq(withdrawalOtpChallenges.id, id), eq(withdrawalOtpChallenges.status, "pending_delivery")));
}

export async function listWalletFundingAttemptsForUser(userId: number) {
  const db = await requireDb();
  return db.select().from(walletFundingAttempts).where(eq(walletFundingAttempts.userId, userId)).orderBy(desc(walletFundingAttempts.createdAt));
}

export async function getWalletFundingAttemptByReference(reference: string) {
  const db = await requireDb();
  const result = await db.select().from(walletFundingAttempts).where(eq(walletFundingAttempts.reference, reference)).limit(1);
  return result[0];
}

export async function createWalletFundingAttempt(input: { walletId: number; userId: number; reference: string; amount: number; provider?: "paystack" | "flutterwave"; orderReference?: string }) {
  const db = await requireDb();
  await db.insert(walletFundingAttempts).values({ ...input, provider: input.provider ?? "paystack", status: "pending" });
  const attempt = await getWalletFundingAttemptByReference(input.reference);
  if (!attempt) throw new Error("Wallet funding attempt could not be created.");
  return attempt;
}

export async function markWalletFundingAttemptFailed(reference: string) {
  const db = await requireDb();
  await db.update(walletFundingAttempts).set({ status: "failed" }).where(and(eq(walletFundingAttempts.reference, reference), eq(walletFundingAttempts.status, "pending")));
  const attempt = await getWalletFundingAttemptByReference(reference);
  if (attempt?.orderReference) await db.update(orders).set({ fulfillmentStatus: "cancelled" }).where(and(eq(orders.reference, attempt.orderReference), eq(orders.paymentStatus, "pending"), eq(orders.fulfillmentStatus, "pending")));
}

export async function listCryptoFundingAttemptsForUser(userId: number) {
  const db = await requireDb();
  return db.select().from(cryptoFundingAttempts).where(eq(cryptoFundingAttempts.userId, userId)).orderBy(desc(cryptoFundingAttempts.createdAt));
}

export async function getCryptoFundingAttemptByReference(reference: string) {
  const db = await requireDb();
  return (await db.select().from(cryptoFundingAttempts).where(eq(cryptoFundingAttempts.reference, reference)).limit(1))[0];
}

export async function createCryptoFundingAttempt(input: { walletId: number; userId: number; reference: string; amountNaira: number; payCurrency: string; quoteExpiresAt: Date; orderReference?: string }) {
  const db = await requireDb();
  await db.insert(cryptoFundingAttempts).values({ ...input, status: "pending" });
  const attempt = await getCryptoFundingAttemptByReference(input.reference);
  if (!attempt) throw new Error("Crypto funding attempt could not be created.");
  return attempt;
}

export async function saveCryptoFundingQuote(input: { reference: string; providerPaymentId: string; quotedPayAmount: string; payAddress: string }) {
  const db = await requireDb();
  await db.update(cryptoFundingAttempts).set({ providerPaymentId: input.providerPaymentId, quotedPayAmount: input.quotedPayAmount, payAddress: input.payAddress }).where(and(eq(cryptoFundingAttempts.reference, input.reference), eq(cryptoFundingAttempts.status, "pending")));
}

export async function markCryptoFundingAttemptStatus(input: { reference: string; status: "failed" | "expired" }) {
  const db = await requireDb();
  await db.update(cryptoFundingAttempts).set({ status: input.status }).where(and(eq(cryptoFundingAttempts.reference, input.reference), eq(cryptoFundingAttempts.status, "pending")));
  const attempt = await getCryptoFundingAttemptByReference(input.reference);
  if (attempt?.orderReference) await db.update(orders).set({ fulfillmentStatus: "cancelled" }).where(and(eq(orders.reference, attempt.orderReference), eq(orders.paymentMethod, "nowpayments"), eq(orders.paymentStatus, "pending")));
}

export async function creditVerifiedCryptoFunding(input: { reference: string; providerPaymentId: string }) {
  const db = await requireDb();
  return db.transaction(async tx => {
    const attempt = (await tx.select().from(cryptoFundingAttempts).where(eq(cryptoFundingAttempts.reference, input.reference)).limit(1))[0];
    if (!attempt) throw new Error("Crypto funding attempt was not found.");
    if (attempt.status === "confirmed") return { attempt, alreadyProcessed: true } as const;
    if (attempt.status !== "pending" || attempt.quoteExpiresAt <= new Date()) throw new Error("Crypto funding attempt is not eligible for crediting.");
    const claim = await tx.update(cryptoFundingAttempts).set({ status: "confirmed", providerPaymentId: input.providerPaymentId, creditedAt: new Date() }).where(and(eq(cryptoFundingAttempts.id, attempt.id), eq(cryptoFundingAttempts.status, "pending")));
    if (affectedRows(claim) !== 1) return { attempt, alreadyProcessed: true } as const;
    if (attempt.orderReference) {
      const paidOrder = await tx.update(orders).set({ paymentStatus: "paid" }).where(and(eq(orders.reference, attempt.orderReference), eq(orders.buyerUserId, attempt.userId), eq(orders.paymentMethod, "nowpayments"), eq(orders.paymentStatus, "pending")));
      if (affectedRows(paidOrder) !== 1) throw new Error("Crypto checkout order was not eligible for completion.");
      return { attempt: { ...attempt, status: "confirmed" as const }, alreadyProcessed: false, checkoutOrderReference: attempt.orderReference } as const;
    }
    const wallet = (await tx.select().from(wallets).where(eq(wallets.id, attempt.walletId)).limit(1))[0];
    if (!wallet || wallet.userId !== attempt.userId) throw new Error("Crypto funding attempt has an invalid wallet owner.");
    await tx.update(wallets).set({ bonusBalance: sql`${wallets.bonusBalance} + ${attempt.amountNaira}` }).where(eq(wallets.id, wallet.id));
    const walletAfter = (await tx.select().from(wallets).where(eq(wallets.id, wallet.id)).limit(1))[0];
    if (!walletAfter) throw new Error("Crypto funding wallet balance could not be loaded.");
    await tx.insert(walletTransactions).values({ walletId: wallet.id, userId: attempt.userId, type: "deposit", direction: "in", status: "completed", amount: attempt.amountNaira, balanceBucket: "bonus", balanceAfter: walletAfter.bonusBalance, reference: attempt.reference, idempotencyKey: `crypto-funding-${attempt.reference}`, description: "NOWPayments confirmed crypto funding — Shopping Bonus only, non-withdrawable" });
    return { attempt: { ...attempt, status: "confirmed" as const }, alreadyProcessed: false } as const;
  });
}

export async function creditVerifiedWalletFunding(input: { reference: string; providerTransactionId: string; provider?: "paystack" | "flutterwave" }) {
  const db = await requireDb();
  return db.transaction(async tx => {
    const attemptResult = await tx.select().from(walletFundingAttempts).where(eq(walletFundingAttempts.reference, input.reference)).limit(1);
    const attempt = attemptResult[0];
    if (!attempt) throw new Error("Wallet funding attempt was not found.");
    if (input.provider && attempt.provider !== input.provider) throw new Error("Verified funding provider did not match the stored attempt.");
    const fundingDisposition = fundingCreditDisposition(attempt.status);
    if (fundingDisposition === "ignore_duplicate") return { attempt, alreadyProcessed: true } as const;
    if (fundingDisposition === "reject") throw new Error("Wallet funding attempt is not eligible for crediting.");
    const stateUpdate = await tx.update(walletFundingAttempts).set({ status: "succeeded", providerTransactionId: input.providerTransactionId, paidAt: new Date() }).where(and(eq(walletFundingAttempts.id, attempt.id), eq(walletFundingAttempts.status, "pending")));
    if (affectedRows(stateUpdate) !== 1) return { attempt, alreadyProcessed: true } as const;
    if (attempt.orderReference) {
      const orderUpdate = await tx.update(orders).set({ paymentStatus: "gateway_escrow" }).where(and(eq(orders.reference, attempt.orderReference), eq(orders.buyerUserId, attempt.userId), eq(orders.paymentMethod, attempt.provider), eq(orders.paymentStatus, "pending")));
      if (affectedRows(orderUpdate) !== 1) throw new Error("Gateway checkout order was not eligible for settlement.");
      await tx.update(escrowAllocations).set({ status: "held" }).where(and(eq(escrowAllocations.orderReference, attempt.orderReference), eq(escrowAllocations.status, "pending")));
      return { attempt: { ...attempt, status: "succeeded" as const }, alreadyProcessed: false, checkoutOrderReference: attempt.orderReference } as const;
    }
    const walletResult = await tx.select().from(wallets).where(eq(wallets.id, attempt.walletId)).limit(1);
    const wallet = walletResult[0];
    if (!wallet || wallet.userId !== attempt.userId) throw new Error("Wallet funding attempt has an invalid wallet owner.");
    await tx.update(wallets).set({ withdrawableBalance: sql`${wallets.withdrawableBalance} + ${attempt.amount}` }).where(eq(wallets.id, wallet.id));
    const walletAfter = (await tx.select().from(wallets).where(eq(wallets.id, wallet.id)).limit(1))[0];
    if (!walletAfter) throw new Error("Wallet funding balance could not be loaded.");
    await tx.insert(walletTransactions).values({
      walletId: wallet.id,
      userId: attempt.userId,
      type: "deposit",
      direction: "in",
      status: "completed",
      amount: attempt.amount,
      balanceAfter: walletAfter.withdrawableBalance,
      reference: input.reference,
      idempotencyKey: `wallet-funding-${input.reference}`,
      description: "Paystack wallet funding verified",
    });
    return { attempt: { ...attempt, status: "succeeded" as const }, alreadyProcessed: false } as const;
  });
}

export async function listWithdrawalRequestsForUser(userId: number) {
  const db = await requireDb();
  return db.select().from(withdrawalRequests).where(eq(withdrawalRequests.userId, userId)).orderBy(desc(withdrawalRequests.createdAt));
}

export async function createPendingWalletWithdrawal(input: { walletId: number; userId: number; recipientId: number; amount: number; transferReference: string }) {
  const db = await requireDb();
  return db.transaction(async tx => {
    const walletResult = await tx.select().from(wallets).where(and(eq(wallets.id, input.walletId), eq(wallets.userId, input.userId))).limit(1);
    const wallet = walletResult[0];
    if (!wallet) throw new Error("Wallet was not found.");
    const debitResult = await tx.update(wallets).set({ withdrawableBalance: sql`${wallets.withdrawableBalance} - ${input.amount}` }).where(and(eq(wallets.id, wallet.id), gte(wallets.withdrawableBalance, input.amount)));
    if (affectedRows(debitResult) !== 1) throw new Error("INSUFFICIENT_WALLET_BALANCE");
    const insertResult = await tx.insert(withdrawalRequests).values({ ...input, status: "pending" });
    const requestId = Number(insertResult[0].insertId);
    const walletAfter = (await tx.select().from(wallets).where(eq(wallets.id, wallet.id)).limit(1))[0];
    if (!walletAfter) throw new Error("Wallet withdrawal balance could not be loaded.");
    await tx.insert(walletTransactions).values({
      walletId: wallet.id,
      userId: input.userId,
      type: "withdrawal",
      direction: "out",
      status: "pending",
      amount: input.amount,
      balanceAfter: walletAfter.withdrawableBalance,
      reference: input.transferReference,
      idempotencyKey: `wallet-withdrawal-${input.transferReference}`,
      description: "Paystack bank withdrawal requested",
    });
    return { id: requestId, walletId: wallet.id, balanceAfter: walletAfter.withdrawableBalance };
  });
}

export async function markWalletWithdrawalProcessing(input: { reference: string; providerTransferCode: string }) {
  const db = await requireDb();
  await db.update(withdrawalRequests).set({ status: "processing", providerTransferCode: input.providerTransferCode, providerReference: input.reference }).where(and(eq(withdrawalRequests.transferReference, input.reference), eq(withdrawalRequests.status, "pending")));
}

type WalletTransactionExecutor = Parameters<Parameters<Awaited<ReturnType<typeof requireDb>>["transaction"]>[0]>[0];

async function restoreWalletWithdrawal(tx: WalletTransactionExecutor, input: { requestId: number; userId: number; walletId: number; amount: number; reference: string; outcome: "failed" | "reversed"; providerTransferCode?: string }) {
  const currentRequest = (await tx.select().from(withdrawalRequests).where(eq(withdrawalRequests.id, input.requestId)).limit(1))[0];
  if (!currentRequest || withdrawalRestoreDisposition(currentRequest.status) === "ignore_duplicate") return false;
  const requestUpdate = await tx.update(withdrawalRequests).set({ status: input.outcome, providerTransferCode: input.providerTransferCode, providerReference: input.reference, reversedAt: new Date() }).where(and(eq(withdrawalRequests.id, input.requestId), eq(withdrawalRequests.status, "pending")));
  if (affectedRows(requestUpdate) !== 1) {
    const processingUpdate = await tx.update(withdrawalRequests).set({ status: input.outcome, providerTransferCode: input.providerTransferCode, providerReference: input.reference, reversedAt: new Date() }).where(and(eq(withdrawalRequests.id, input.requestId), eq(withdrawalRequests.status, "processing")));
    if (affectedRows(processingUpdate) !== 1) return false;
  }
  await tx.update(wallets).set({ withdrawableBalance: sql`${wallets.withdrawableBalance} + ${input.amount}` }).where(eq(wallets.id, input.walletId));
  const walletAfter = (await tx.select().from(wallets).where(eq(wallets.id, input.walletId)).limit(1))[0];
  if (!walletAfter) throw new Error("Wallet withdrawal refund balance could not be loaded.");
  await tx.update(walletTransactions).set({ status: input.outcome }).where(eq(walletTransactions.idempotencyKey, `wallet-withdrawal-${input.reference}`));
  await tx.insert(walletTransactions).values({
    walletId: input.walletId,
    userId: input.userId,
    type: "refund",
    direction: "in",
    status: input.outcome,
    amount: input.amount,
    balanceAfter: walletAfter.withdrawableBalance,
    reference: input.reference,
    idempotencyKey: `wallet-withdrawal-refund-${input.reference}`,
    description: input.outcome === "reversed" ? "Bank withdrawal reversed; funds restored" : "Bank withdrawal was not accepted; funds restored",
  });
  return true;
}

export async function failWalletWithdrawalBeforeTransfer(reference: string) {
  const db = await requireDb();
  return db.transaction(async tx => {
    const request = (await tx.select().from(withdrawalRequests).where(eq(withdrawalRequests.transferReference, reference)).limit(1))[0];
    if (!request) throw new Error("Wallet withdrawal request was not found.");
    return restoreWalletWithdrawal(tx, { requestId: request.id, userId: request.userId, walletId: request.walletId, amount: request.amount, reference, outcome: "failed" });
  });
}

export async function markWalletWithdrawalPaid(input: { reference: string; providerTransferCode?: string }) {
  const db = await requireDb();
  return db.transaction(async tx => {
    const request = (await tx.select().from(withdrawalRequests).where(eq(withdrawalRequests.transferReference, input.reference)).limit(1))[0];
    if (!request) return { ignored: true } as const;
    if (withdrawalPaidDisposition(request.status) === "ignore_duplicate") return { ignored: true } as const;
    const updateResult = await tx.update(withdrawalRequests).set({ status: "paid", providerTransferCode: input.providerTransferCode, providerReference: input.reference }).where(and(eq(withdrawalRequests.id, request.id), eq(withdrawalRequests.status, request.status)));
    if (affectedRows(updateResult) !== 1) return { ignored: true } as const;
    await tx.update(walletTransactions).set({ status: "completed" }).where(eq(walletTransactions.idempotencyKey, `wallet-withdrawal-${input.reference}`));
    return { ignored: false } as const;
  });
}

export async function reverseWalletWithdrawal(input: { reference: string; outcome: "failed" | "reversed"; providerTransferCode?: string }) {
  const db = await requireDb();
  return db.transaction(async tx => {
    const request = (await tx.select().from(withdrawalRequests).where(eq(withdrawalRequests.transferReference, input.reference)).limit(1))[0];
    if (!request) return { ignored: true } as const;
    const restored = await restoreWalletWithdrawal(tx, { requestId: request.id, userId: request.userId, walletId: request.walletId, amount: request.amount, reference: input.reference, outcome: input.outcome, providerTransferCode: input.providerTransferCode });
    return { ignored: !restored } as const;
  });
}

export async function updateWalletPin(userId: number, pinHash: string) {
  const db = await requireDb();
  await db.update(wallets).set({ pinHash, pinFailedAttempts: 0, pinLockedUntil: null }).where(eq(wallets.userId, userId));
}

export async function recordWalletPinFailure(userId: number, failedAttempts: number, lockedUntil: Date | null) {
  const db = await requireDb();
  await db.update(wallets).set({ pinFailedAttempts: failedAttempts, pinLockedUntil: lockedUntil }).where(eq(wallets.userId, userId));
}

export async function resetWalletPinFailures(userId: number) {
  const db = await requireDb();
  await db.update(wallets).set({ pinFailedAttempts: 0, pinLockedUntil: null }).where(eq(wallets.userId, userId));
}

export type WalletEscrowAllocationInput = {
  vendorUserId: number;
  grossAmount: number;
  commissionAmount: number;
  netAmount: number;
};

function affectedRows(result: unknown) {
  const header = Array.isArray(result) ? result[0] : result;
  return Number((header as { affectedRows?: number } | undefined)?.affectedRows ?? 0);
}

export async function createWalletEscrowOrder(input: {
  buyerUserId: number;
  order: InsertOrder;
  allocations: WalletEscrowAllocationInput[];
  fulfilmentJobInputs?: FulfilmentJobInput[];
  freeDeliveryVoucherId?: number;
}) {
  const db = await requireDb();
  return db.transaction(async tx => {
    await tx.insert(wallets).values({ userId: input.buyerUserId }).onDuplicateKeyUpdate({ set: { userId: sql`${wallets.userId}` } });
    const walletResult = await tx.select().from(wallets).where(eq(wallets.userId, input.buyerUserId)).limit(1);
    const wallet = walletResult[0];
    if (!wallet) throw new Error("Wallet was not found.");

    const { bonusDebit, withdrawableDebit } = splitWalletPayment(input.order.total, wallet.bonusBalance);
    const debitResult = await tx
      .update(wallets)
      .set({
        bonusBalance: sql`${wallets.bonusBalance} - ${bonusDebit}`,
        withdrawableBalance: sql`${wallets.withdrawableBalance} - ${withdrawableDebit}`,
        escrowBalance: sql`${wallets.escrowBalance} + ${input.order.total}`,
      })
      .where(and(
        eq(wallets.id, wallet.id),
        gte(wallets.bonusBalance, bonusDebit),
        gte(wallets.withdrawableBalance, withdrawableDebit),
      ));
    if (affectedRows(debitResult) !== 1) throw new Error("INSUFFICIENT_WALLET_BALANCE");

    await tx.insert(orders).values(input.order);
    if (input.freeDeliveryVoucherId) {
      const claim = await tx.update(freeDeliveryVouchers).set({ status: "redeemed", redeemedAt: new Date(), redeemedOrderReference: input.order.reference }).where(and(eq(freeDeliveryVouchers.id, input.freeDeliveryVoucherId), eq(freeDeliveryVouchers.userId, input.buyerUserId), eq(freeDeliveryVouchers.status, "active")));
      if (affectedRows(claim) !== 1) throw new Error("That free-delivery voucher is no longer available.");
    }
    const walletAfterDebit = await tx.select().from(wallets).where(eq(wallets.id, wallet.id)).limit(1);
    const walletAfter = walletAfterDebit[0];
    if (!walletAfter) throw new Error("Wallet checkout balance could not be loaded.");
    const buyerTransactions: InsertWalletTransaction[] = [];
    if (bonusDebit > 0) {
      buyerTransactions.push({
        walletId: wallet.id, userId: input.buyerUserId, type: "bonus_purchase", direction: "out", status: "held", amount: bonusDebit,
        balanceBucket: "bonus", balanceAfter: walletAfter.bonusBalance, reference: input.order.reference,
        idempotencyKey: `wallet-order-bonus-${input.order.reference}`, orderReference: input.order.reference,
        description: `Shopping bonus applied to order ${input.order.reference}`,
      });
    }
    if (withdrawableDebit > 0) {
      buyerTransactions.push({
        walletId: wallet.id, userId: input.buyerUserId, type: "purchase_escrow", direction: "out", status: "held", amount: withdrawableDebit,
        balanceBucket: "withdrawable", balanceAfter: walletAfter.withdrawableBalance, reference: input.order.reference,
        idempotencyKey: `wallet-order-withdrawable-${input.order.reference}`, orderReference: input.order.reference,
        description: `Withdrawable funds held for order ${input.order.reference}`,
      });
    }
    if (buyerTransactions.length) await tx.insert(walletTransactions).values(buyerTransactions);

    if (input.allocations.length) {
      await tx.insert(escrowAllocations).values(input.allocations.map(allocation => ({
        orderReference: input.order.reference,
        buyerWalletId: wallet.id,
        vendorUserId: allocation.vendorUserId,
        grossAmount: allocation.grossAmount,
        commissionAmount: allocation.commissionAmount,
        netAmount: allocation.netAmount,
        status: "held" as const,
      })));
    }
    if (input.fulfilmentJobInputs?.length) {
      await tx.insert(fulfilmentJobs).values(input.fulfilmentJobInputs.map(job => ({ ...job, status: "queued" as const }))).onDuplicateKeyUpdate({ set: { idempotencyKey: sql`${fulfilmentJobs.idempotencyKey}` } });
    }
    return { wallet, bonusDebit, withdrawableDebit, totalBalanceAfter: walletAfter.bonusBalance + walletAfter.withdrawableBalance };
  });
}

export async function releaseWalletEscrowOrder(reference: string) {
  const db = await requireDb();
  return db.transaction(async tx => {
    const orderResult = await tx.select().from(orders).where(eq(orders.reference, reference)).limit(1);
    const order = orderResult[0];
    if (!order) throw new Error("Order was not found.");
    if (order.paymentMethod !== "wallet" || order.paymentStatus !== "wallet_escrow") throw new Error("This order does not have held wallet escrow.");
    const releaseClaim = await tx.update(orders).set({ fulfillmentStatus: "delivered", paymentStatus: "wallet_released", deliveredAt: new Date() }).where(and(eq(orders.reference, reference), eq(orders.paymentMethod, "wallet"), eq(orders.paymentStatus, "wallet_escrow")));
    if (affectedRows(releaseClaim) !== 1) throw new Error("This order does not have held wallet escrow.");
    const buyerWalletResult = await tx.select().from(wallets).where(eq(wallets.userId, order.buyerUserId ?? -1)).limit(1);
    const buyerWallet = buyerWalletResult[0];
    if (!buyerWallet) throw new Error("Buyer wallet was not found.");
    const buyerEscrowDebit = await tx.update(wallets).set({ escrowBalance: sql`${wallets.escrowBalance} - ${order.total}` }).where(and(eq(wallets.id, buyerWallet.id), gte(wallets.escrowBalance, order.total)));
    if (affectedRows(buyerEscrowDebit) !== 1) throw new Error("Wallet escrow balance is inconsistent.");

    const allocations = await tx.select().from(escrowAllocations).where(and(eq(escrowAllocations.orderReference, reference), eq(escrowAllocations.status, "held")));
    const releasedVendors: Array<{ userId: number; amount: number }> = [];
    for (const allocation of allocations) {
      const allocationUpdate = await tx.update(escrowAllocations).set({ status: "released", releasedAt: new Date() }).where(and(eq(escrowAllocations.id, allocation.id), eq(escrowAllocations.status, "held")));
      if (affectedRows(allocationUpdate) !== 1) continue;
      await tx.insert(wallets).values({ userId: allocation.vendorUserId }).onDuplicateKeyUpdate({ set: { userId: sql`${wallets.userId}` } });
      await tx.update(wallets).set({ withdrawableBalance: sql`${wallets.withdrawableBalance} + ${allocation.netAmount}` }).where(eq(wallets.userId, allocation.vendorUserId));
      const vendorWalletResult = await tx.select().from(wallets).where(eq(wallets.userId, allocation.vendorUserId)).limit(1);
      const vendorWallet = vendorWalletResult[0];
      if (!vendorWallet) throw new Error("Vendor wallet was not found.");
      await tx.insert(walletTransactions).values({
        walletId: vendorWallet.id,
        userId: allocation.vendorUserId,
        type: "sale_earning",
        direction: "in",
        status: "released",
        amount: allocation.netAmount,
        balanceAfter: vendorWallet.withdrawableBalance,
        reference,
        idempotencyKey: `wallet-release-${reference}-${allocation.id}`,
        orderReference: reference,
        description: `Sale earning released for order ${reference}`,
      });
      releasedVendors.push({ userId: allocation.vendorUserId, amount: allocation.netAmount });
    }
    return { order, releasedVendors };
  });
}

export async function markWalletOrderDelivered(reference: string) {
  const db = await requireDb();
  const result = await db.update(orders).set({ fulfillmentStatus: "delivered", deliveredAt: new Date() }).where(and(eq(orders.reference, reference), eq(orders.paymentMethod, "wallet"), eq(orders.paymentStatus, "wallet_escrow"), eq(orders.fulfillmentStatus, "pending")));
  if (affectedRows(result) !== 1) throw new Error("This wallet order is no longer awaiting delivery confirmation.");
  return { reference };
}

export async function confirmBuyerReceivedWalletOrder(userId: number, reference: string) {
  const db = await requireDb();
  await db.transaction(async tx => {
    const order = (await tx.select().from(orders).where(eq(orders.reference, reference)).limit(1))[0];
    if (!order || order.buyerUserId !== userId) throw new Error("That order is not available for your confirmation.");
    if (order.paymentMethod !== "wallet" || order.paymentStatus !== "wallet_escrow" || order.fulfillmentStatus !== "delivered") throw new Error("This order is not ready for delivery confirmation.");
    if (!order.orderLines.some(line => Boolean(line.vendorUserId))) throw new Error("Buyer confirmation is available only for local-vendor wallet orders.");
    const confirmed = await tx.update(orders).set({ buyerConfirmedAt: new Date() }).where(and(eq(orders.reference, reference), isNull(orders.buyerConfirmedAt), eq(orders.paymentStatus, "wallet_escrow"), eq(orders.fulfillmentStatus, "delivered")));
    if (affectedRows(confirmed) !== 1) throw new Error("This delivery has already been confirmed or is no longer eligible.");
  });
  return releaseWalletEscrowOrder(reference);
}

export async function listBuyerWalletEscrowOrders(userId: number) {
  const db = await requireDb();
  return db.select({ reference: orders.reference, total: orders.total, fulfillmentStatus: orders.fulfillmentStatus, deliveredAt: orders.deliveredAt, buyerConfirmedAt: orders.buyerConfirmedAt, createdAt: orders.createdAt, orderLines: orders.orderLines }).from(orders).where(and(eq(orders.buyerUserId, userId), eq(orders.paymentMethod, "wallet"), eq(orders.paymentStatus, "wallet_escrow"))).orderBy(desc(orders.createdAt));
}

export async function getSupportOrderSummary(userId: number, reference: string) {
  const db = await requireDb();
  const results = await db.select({ reference: orders.reference, paymentStatus: orders.paymentStatus, fulfillmentStatus: orders.fulfillmentStatus, createdAt: orders.createdAt }).from(orders).where(and(eq(orders.buyerUserId, userId), eq(orders.reference, reference))).limit(1);
  return results[0] ?? null;
}

export async function searchPublishedSupportProducts(query: string, limit = 4) {
  const genericTerms = new Set(["alpha", "market", "recommend", "recommendation", "product", "products", "show", "looking", "please", "with", "about", "need", "want", "can", "you", "your", "for", "the", "and"]);
  const terms = (query.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []).filter(term => !genericTerms.has(term)).slice(0, 6);
  if (!terms.length) return [];
  const [official, vendor] = await Promise.all([listActiveOfficialProducts(), listApprovedVendorProducts()]);
  const catalogue = [
    ...official.map(product => ({ title: product.title, description: product.description, category: product.category, price: product.price, url: `/product/official-${product.id}` })),
    ...vendor.map(product => ({ title: product.title, description: product.description, category: product.category, price: product.price, url: `/product/vendor-${product.id}` })),
  ];
  return catalogue.map(product => ({ ...product, score: terms.reduce((score, term) => score + (product.title.toLowerCase().includes(term) ? 3 : 0) + (product.category.toLowerCase().includes(term) ? 2 : 0) + (product.description.toLowerCase().includes(term) ? 1 : 0), 0) })).filter(product => product.score > 0).sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, Math.min(4, Math.max(1, limit))).map(({ title, price, url }) => ({ title, price, url }));
}

export async function getEscrowReleaseSettings() {
  const db = await requireDb();
  await db.insert(escrowReleaseSettings).values({ id: 1 }).onDuplicateKeyUpdate({ set: { id: sql`${escrowReleaseSettings.id}` } });
  return (await db.select().from(escrowReleaseSettings).where(eq(escrowReleaseSettings.id, 1)).limit(1))[0];
}

export async function saveEscrowReleaseScheduleTaskUid(taskUid: string) {
  const db = await requireDb();
  await db.insert(escrowReleaseSettings).values({ id: 1, scheduleTaskUid: taskUid }).onDuplicateKeyUpdate({ set: { scheduleTaskUid: taskUid, lastError: null } });
}

export async function releaseMatureLocalVendorEscrows(now = new Date(), limit = 100) {
  const db = await requireDb();
  const settings = await getEscrowReleaseSettings();
  await db.update(escrowReleaseSettings).set({ lastStartedAt: now, lastError: null }).where(eq(escrowReleaseSettings.id, settings?.id ?? 1));
  const dueAt = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const candidates = await db.select({ reference: orders.reference, orderLines: orders.orderLines }).from(orders).where(and(eq(orders.paymentMethod, "wallet"), eq(orders.paymentStatus, "wallet_escrow"), eq(orders.fulfillmentStatus, "delivered"), lte(orders.deliveredAt, dueAt))).limit(limit);
  let released = 0;
  for (const candidate of candidates) {
    if (!candidate.orderLines.some(line => Boolean(line.vendorUserId))) continue;
    try { await releaseWalletEscrowOrder(candidate.reference); released += 1; } catch { /* Concurrent buyer confirmation or return makes the release ineligible. */ }
  }
  await db.update(escrowReleaseSettings).set({ lastCompletedAt: new Date(), lastError: null }).where(eq(escrowReleaseSettings.id, settings?.id ?? 1));
  return { released, scanned: candidates.length };
}

export async function listHeldWalletOrders() {
  const db = await requireDb();
  return db.select({
    reference: orders.reference,
    buyerName: orders.buyerName,
    buyerPhone: orders.buyerPhone,
    deliveryAddress: orders.deliveryAddress,
    subtotal: orders.subtotal,
    deliveryFee: orders.deliveryFee,
    total: orders.total,
    paymentStatus: orders.paymentStatus,
    fulfillmentStatus: orders.fulfillmentStatus,
    createdAt: orders.createdAt,
  }).from(orders).where(and(eq(orders.paymentMethod, "wallet"), eq(orders.paymentStatus, "wallet_escrow"))).orderBy(desc(orders.createdAt));
}

export async function listOrdersAwaitingDelivery() {
  const db = await requireDb();
  return db.select({
    reference: orders.reference,
    buyerName: orders.buyerName,
    buyerPhone: orders.buyerPhone,
    deliveryAddress: orders.deliveryAddress,
    subtotal: orders.subtotal,
    deliveryFee: orders.deliveryFee,
    total: orders.total,
    paymentMethod: orders.paymentMethod,
    paymentStatus: orders.paymentStatus,
    referralCode: orders.referralCode,
    createdAt: orders.createdAt,
  }).from(orders).where(eq(orders.fulfillmentStatus, "pending")).orderBy(desc(orders.createdAt));
}

export async function listOrdersInRewardReturnWindow(now = new Date()) {
  const db = await requireDb();
  const returnWindowStart = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  return db.select({
    reference: orders.reference,
    buyerName: orders.buyerName,
    total: orders.total,
    paymentMethod: orders.paymentMethod,
    deliveryAddress: orders.deliveryAddress,
    deliveredAt: orders.deliveredAt,
  }).from(orders).where(and(eq(orders.fulfillmentStatus, "delivered"), gte(orders.deliveredAt, returnWindowStart))).orderBy(desc(orders.deliveredAt));
}

export async function markNonWalletOrderDelivered(reference: string) {
  const db = await requireDb();
  return db.transaction(async tx => {
    const order = (await tx.select().from(orders).where(eq(orders.reference, reference)).limit(1))[0];
    if (!order) throw new Error("Order was not found.");
    if (order.paymentMethod === "wallet") throw new Error("Use the wallet escrow delivery release for a wallet order.");
    const result = await tx.update(orders).set({ fulfillmentStatus: "delivered", deliveredAt: new Date() }).where(and(eq(orders.reference, reference), eq(orders.fulfillmentStatus, "pending")));
    if (affectedRows(result) !== 1) throw new Error("This order is no longer awaiting delivery confirmation.");
    return { ...order, fulfillmentStatus: "delivered" as const };
  });
}

export async function markDeliveredOrderReturned(reference: string) {
  const db = await requireDb();
  return db.transaction(async tx => {
    const updated = await tx.update(orders).set({ fulfillmentStatus: "returned", returnedAt: new Date() }).where(and(eq(orders.reference, reference), eq(orders.fulfillmentStatus, "delivered")));
    if (affectedRows(updated) !== 1) throw new Error("Only a delivered order can be marked as returned.");
    return { reference };
  });
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

export async function getReferralRewardSettings() {
  const db = await requireDb();
  await db.insert(referralRewardSettings).values({ id: 1 }).onDuplicateKeyUpdate({ set: { id: sql`${referralRewardSettings.id}` } });
  const settings = (await db.select().from(referralRewardSettings).where(eq(referralRewardSettings.id, 1)).limit(1))[0];
  if (!settings) throw new Error("Referral reward settings could not be loaded.");
  return settings;
}

export async function updateReferralRewardSettings(input: { minimumFirstOrderSubtotal: number; referralBonusAmount: number }) {
  const db = await requireDb();
  await db.insert(referralRewardSettings).values({ id: 1, ...input }).onDuplicateKeyUpdate({ set: input });
  return getReferralRewardSettings();
}

export async function getUserSecuritySignal(userId: number) {
  const db = await requireDb();
  return (await db.select().from(userSecuritySignals).where(eq(userSecuritySignals.userId, userId)).limit(1))[0];
}

export async function recordUserSecuritySignal(input: { userId: number; deviceFingerprintHash: string | null; ipHash: string | null }) {
  const db = await requireDb();
  await db.insert(userSecuritySignals).values(input).onDuplicateKeyUpdate({
    set: {
      deviceFingerprintHash: sql`coalesce(${userSecuritySignals.deviceFingerprintHash}, ${input.deviceFingerprintHash})`,
      ipHash: sql`coalesce(${userSecuritySignals.ipHash}, ${input.ipHash})`,
      lastSeenAt: new Date(),
    },
  });
}

export async function recordUserRequestSecuritySignal(input: { userId: number; deviceId: string | null; ipAddress: string | null }) {
  return recordUserSecuritySignal({
    userId: input.userId,
    deviceFingerprintHash: hashSecuritySignal(normalizeDeviceId(input.deviceId)),
    ipHash: hashSecuritySignal(input.ipAddress),
  });
}

export async function isReferralEligibleUser(userId: number) {
  const [profile, recipient] = await Promise.all([getKycProfileForUser(userId), getWalletBankRecipientForUser(userId)]);
  return profile?.status === "verified" || profile?.status === "identity_verified" || recipient?.kycBindingStatus === "locked";
}

export async function assessReferralFraudBeforeCheckout(input: { referralShareId: number; sharerUserId: number; referredUserId: number }) {
  const db = await requireDb();
  return db.transaction(async tx => {
    const [sharerSignal, referredSignal] = await Promise.all([
      tx.select().from(userSecuritySignals).where(eq(userSecuritySignals.userId, input.sharerUserId)).limit(1),
      tx.select().from(userSecuritySignals).where(eq(userSecuritySignals.userId, input.referredUserId)).limit(1),
    ]);
    const sameDevice = Boolean(sharerSignal[0]?.deviceFingerprintHash && sharerSignal[0]?.deviceFingerprintHash === referredSignal[0]?.deviceFingerprintHash);
    const sameIp = Boolean(sharerSignal[0]?.ipHash && sharerSignal[0]?.ipHash === referredSignal[0]?.ipHash);
    const reason = sameDevice ? "same_device" as const : sameIp ? "same_ip" as const : "none" as const;
    if (reason === "none") return { flagged: false, reason };
    await tx.insert(referralFraudChecks).values({ referralShareId: input.referralShareId, referredUserId: input.referredUserId, status: "flagged", reason });
    await tx.update(referralShares).set({ status: "voided", rewardStatus: "voided", referredUserId: input.referredUserId, fraudStatus: "flagged", fraudReason: reason }).where(and(eq(referralShares.id, input.referralShareId), eq(referralShares.status, "shared")));
    return { flagged: true, reason };
  });
}

export async function queueReferralBonusAfterDeliveredOrder(reference: string) {
  const db = await requireDb();
  return db.transaction(async tx => {
    const order = (await tx.select().from(orders).where(eq(orders.reference, reference)).limit(1))[0];
    if (!order?.buyerUserId || !order.referralCode?.startsWith("ALPHA-") || order.fulfillmentStatus !== "delivered") return { queued: false, reason: "not_eligible" as const };
    const share = (await tx.select().from(referralShares).where(eq(referralShares.shareCode, order.referralCode)).limit(1))[0];
    if (!share || share.status !== "shared") return { queued: false, reason: "already_decided" as const };

    const previousCompleted = await tx.select({ reference: orders.reference }).from(orders).where(and(
      eq(orders.buyerUserId, order.buyerUserId),
      eq(orders.fulfillmentStatus, "delivered"),
      lt(orders.createdAt, order.createdAt),
    )).limit(1);
    const [sharerSignal, referredSignal] = await Promise.all([
      tx.select().from(userSecuritySignals).where(eq(userSecuritySignals.userId, share.sharerUserId)).limit(1),
      tx.select().from(userSecuritySignals).where(eq(userSecuritySignals.userId, order.buyerUserId)).limit(1),
    ]);
    const sameDevice = Boolean(sharerSignal[0]?.deviceFingerprintHash && sharerSignal[0]?.deviceFingerprintHash === referredSignal[0]?.deviceFingerprintHash);
    const sameIp = Boolean(sharerSignal[0]?.ipHash && sharerSignal[0]?.ipHash === referredSignal[0]?.ipHash);
    const fraudReason = sameDevice ? "same_device" as const : sameIp ? "same_ip" as const : "none" as const;
    const mustVoid = previousCompleted.length > 0 || order.subtotal < share.minimumOrderSubtotal || fraudReason !== "none";
    await tx.insert(referralFraudChecks).values({ referralShareId: share.id, referredUserId: order.buyerUserId, status: fraudReason === "none" ? "clear" : "flagged", reason: fraudReason });

    if (mustVoid) {
      const reason = fraudReason === "none" ? (previousCompleted.length ? "not_first_completed_order" : "minimum_spend_not_met") : fraudReason;
      await tx.update(referralShares).set({ status: "voided", rewardStatus: "voided", referredOrderReference: reference, referredUserId: order.buyerUserId, fraudStatus: fraudReason === "none" ? "clear" : "flagged", fraudReason: reason }).where(and(eq(referralShares.id, share.id), eq(referralShares.status, "shared")));
      return { queued: false, reason: reason as string };
    }

    await tx.insert(wallets).values([{ userId: share.sharerUserId }, { userId: order.buyerUserId }]).onDuplicateKeyUpdate({ set: { userId: sql`${wallets.userId}` } });
    const rewardWallets = await tx.select().from(wallets).where(or(eq(wallets.userId, share.sharerUserId), eq(wallets.userId, order.buyerUserId)));
    const sharerWallet = rewardWallets.find(wallet => wallet.userId === share.sharerUserId);
    const referredWallet = rewardWallets.find(wallet => wallet.userId === order.buyerUserId);
    if (!sharerWallet || !referredWallet) throw new Error("Referral reward wallets could not be provisioned.");
    const releaseAt = new Date((order.deliveredAt ?? new Date()).getTime() + 48 * 60 * 60 * 1000);
    await tx.insert(bonusRewardHolds).values([
      { walletId: sharerWallet.id, userId: share.sharerUserId, orderReference: reference, referralShareId: share.id, type: "referral", beneficiary: "sharer", amount: share.rewardValue, status: "pending", releaseAt, idempotencyKey: `referral-bonus-sharer-${reference}-${share.id}` },
      { walletId: referredWallet.id, userId: order.buyerUserId, orderReference: reference, referralShareId: share.id, type: "referral", beneficiary: "referred", amount: share.rewardValue, status: "pending", releaseAt, idempotencyKey: `referral-bonus-referred-${reference}-${share.id}` },
    ]).onDuplicateKeyUpdate({ set: { idempotencyKey: sql`${bonusRewardHolds.idempotencyKey}` } });
    await tx.update(referralShares).set({ status: "qualified", rewardStatus: "pending", referredOrderReference: reference, referredUserId: order.buyerUserId, fraudStatus: "clear", fraudReason: null }).where(and(eq(referralShares.id, share.id), eq(referralShares.status, "shared")));
    return { queued: true, releaseAt };
  });
}

export async function queueVerifiedPostSaleBonus(input: { reference: string; type: "cashback" | "review"; amount: number }) {
  const db = await requireDb();
  return db.transaction(async tx => {
    const order = (await tx.select().from(orders).where(eq(orders.reference, input.reference)).limit(1))[0];
    if (!order?.buyerUserId || order.fulfillmentStatus !== "delivered") throw new Error("Only a delivered order can receive a post-sale Shopping Bonus.");
    await tx.insert(wallets).values({ userId: order.buyerUserId }).onDuplicateKeyUpdate({ set: { userId: sql`${wallets.userId}` } });
    const wallet = (await tx.select().from(wallets).where(eq(wallets.userId, order.buyerUserId)).limit(1))[0];
    if (!wallet) throw new Error("Customer wallet could not be provisioned for the post-sale bonus.");
    const releaseAt = new Date((order.deliveredAt ?? new Date()).getTime() + 48 * 60 * 60 * 1000);
    const idempotencyKey = `post-sale-bonus-${input.type}-${input.reference}-${order.buyerUserId}`;
    await tx.insert(bonusRewardHolds).values({
      walletId: wallet.id, userId: order.buyerUserId, orderReference: input.reference, type: input.type,
      beneficiary: "customer", amount: input.amount, status: "pending", releaseAt, idempotencyKey,
    }).onDuplicateKeyUpdate({ set: { idempotencyKey: sql`${bonusRewardHolds.idempotencyKey}` } });
    return { releaseAt, amount: input.amount, type: input.type };
  });
}

export async function releaseMatureBonusRewards(now = new Date(), limit = 100) {
  const db = await requireDb();
  return db.transaction(async tx => {
    const holds = await tx.select().from(bonusRewardHolds).where(and(eq(bonusRewardHolds.status, "pending"), lte(bonusRewardHolds.releaseAt, now))).orderBy(bonusRewardHolds.releaseAt).limit(limit);
    let released = 0;
    for (const hold of holds) {
      const claimed = await tx.update(bonusRewardHolds).set({ status: "released", releasedAt: now }).where(and(eq(bonusRewardHolds.id, hold.id), eq(bonusRewardHolds.status, "pending")));
      if (affectedRows(claimed) !== 1) continue;
      await tx.update(wallets).set({ bonusBalance: sql`${wallets.bonusBalance} + ${hold.amount}` }).where(eq(wallets.id, hold.walletId));
      const wallet = (await tx.select().from(wallets).where(eq(wallets.id, hold.walletId)).limit(1))[0];
      if (!wallet) throw new Error("Bonus reward wallet was not found.");
      await tx.insert(walletTransactions).values({
        walletId: hold.walletId, userId: hold.userId, type: "reward_bonus", direction: "in", status: "released", amount: hold.amount,
        balanceBucket: "bonus", balanceAfter: wallet.bonusBalance, reference: `reward-${hold.id}`,
        idempotencyKey: `bonus-release-${hold.id}`, orderReference: hold.orderReference,
        description: `${hold.type === "referral" ? "Referral" : hold.type === "cashback" ? "Cashback" : "Review"} shopping bonus released`,
      });
      if (hold.referralShareId) await tx.update(referralShares).set({ status: "rewarded", rewardStatus: "released" }).where(eq(referralShares.id, hold.referralShareId));
      released += 1;
    }
    const grants = await tx.select().from(rewardGrants).where(and(eq(rewardGrants.status, "pending"), lte(rewardGrants.releaseAt, now))).orderBy(rewardGrants.releaseAt).limit(Math.max(0, limit - released));
    for (const grant of grants) {
      const claimed = await tx.update(rewardGrants).set({ status: "released", releasedAt: now }).where(and(eq(rewardGrants.id, grant.id), eq(rewardGrants.status, "pending")));
      if (affectedRows(claimed) !== 1) continue;
      await tx.update(wallets).set({ bonusBalance: sql`${wallets.bonusBalance} + ${grant.amount}` }).where(eq(wallets.id, grant.walletId));
      const wallet = (await tx.select().from(wallets).where(eq(wallets.id, grant.walletId)).limit(1))[0];
      if (!wallet) throw new Error("Vendor reward wallet was not found.");
      await tx.insert(walletTransactions).values({ walletId: grant.walletId, userId: grant.userId, type: "reward_bonus", direction: "in", status: "released", amount: grant.amount, balanceBucket: "bonus", balanceAfter: wallet.bonusBalance, reference: `reward-grant-${grant.id}`, idempotencyKey: `reward-grant-release-${grant.id}`, orderReference: grant.sourceOrderReference ?? undefined, description: `${grant.type === "vendor_leaderboard" ? "Leaderboard" : grant.type === "vendor_dispatch" ? "Lightning Seller" : "KYC"} shopping bonus released` });
      released += 1;
    }
    return { released };
  });
}

export async function getRewardsAutomationSettings() {
  const db = await requireDb();
  await db.insert(rewardsAutomationSettings).values({ id: 1 }).onDuplicateKeyUpdate({ set: { id: sql`${rewardsAutomationSettings.id}` } });
  const settings = (await db.select().from(rewardsAutomationSettings).where(eq(rewardsAutomationSettings.id, 1)).limit(1))[0];
  if (!settings) throw new Error("Rewards automation settings could not be loaded.");
  return settings;
}

export async function cancelPendingBonusRewardsForReturnedOrder(reference: string) {
  const db = await requireDb();
  return db.transaction(async tx => {
    const result = await tx.update(bonusRewardHolds).set({ status: "cancelled", cancelledAt: new Date() }).where(and(eq(bonusRewardHolds.orderReference, reference), eq(bonusRewardHolds.status, "pending")));
    const holds = await tx.select({ referralShareId: bonusRewardHolds.referralShareId }).from(bonusRewardHolds).where(eq(bonusRewardHolds.orderReference, reference));
    const shareIds = holds.flatMap(hold => hold.referralShareId ? [hold.referralShareId] : []);
    for (const shareId of shareIds) await tx.update(referralShares).set({ status: "voided", rewardStatus: "cancelled" }).where(eq(referralShares.id, shareId));
    return { cancelled: affectedRows(result) };
  });
}

export async function queueCashbackAfterDeliveredOrder(reference: string) {
  const db = await requireDb();
  return db.transaction(async tx => {
    const order = (await tx.select().from(orders).where(eq(orders.reference, reference)).limit(1))[0];
    if (!order?.buyerUserId || order.fulfillmentStatus !== "delivered") return { queued: false, reason: "not_delivered" as const };
    const amount = Math.floor(order.total * CASHBACK_RATE);
    if (amount < 1) return { queued: false, reason: "zero_value" as const };
    await tx.insert(wallets).values({ userId: order.buyerUserId }).onDuplicateKeyUpdate({ set: { userId: sql`${wallets.userId}` } });
    const wallet = (await tx.select().from(wallets).where(eq(wallets.userId, order.buyerUserId)).limit(1))[0];
    if (!wallet) throw new Error("Cashback wallet could not be provisioned.");
    const releaseAt = new Date((order.deliveredAt ?? new Date()).getTime() + 48 * 60 * 60 * 1000);
    await tx.insert(bonusRewardHolds).values({ walletId: wallet.id, userId: order.buyerUserId, orderReference: reference, type: "cashback", beneficiary: "customer", amount, status: "pending", releaseAt, idempotencyKey: `cashback-${reference}-${order.buyerUserId}` }).onDuplicateKeyUpdate({ set: { idempotencyKey: sql`${bonusRewardHolds.idempotencyKey}` } });
    return { queued: true, amount, releaseAt };
  });
}

export async function issueFreeDeliveryVoucherIfQualified(reference: string) {
  const db = await requireDb();
  return db.transaction(async tx => {
    const order = (await tx.select().from(orders).where(eq(orders.reference, reference)).limit(1))[0];
    if (!order?.buyerUserId || order.fulfillmentStatus !== "delivered") return { issued: false, reason: "not_delivered" as const };
    const month = rewardMonthKey(order.deliveredAt ?? order.createdAt);
    const { start, end } = rewardMonthRange(month);
    const deliveredOrders = await tx.select({ total: orders.total }).from(orders).where(and(eq(orders.buyerUserId, order.buyerUserId), eq(orders.fulfillmentStatus, "delivered"), gte(orders.deliveredAt, start), lt(orders.deliveredAt, end)));
    const deliveredSpend = deliveredOrders.reduce((total, item) => total + item.total, 0);
    if (deliveredSpend < FREE_DELIVERY_MONTHLY_THRESHOLD) return { issued: false, reason: "threshold_not_met" as const, deliveredSpend };
    await tx.insert(freeDeliveryVouchers).values({ userId: order.buyerUserId, earnedMonth: month, earnedOrderReference: reference, idempotencyKey: `free-delivery-${order.buyerUserId}-${month}` }).onDuplicateKeyUpdate({ set: { idempotencyKey: sql`${freeDeliveryVouchers.idempotencyKey}` } });
    return { issued: true, deliveredSpend, month };
  });
}

export async function listActiveFreeDeliveryVouchers(userId: number) {
  const db = await requireDb();
  return db.select().from(freeDeliveryVouchers).where(and(eq(freeDeliveryVouchers.userId, userId), eq(freeDeliveryVouchers.status, "active"))).orderBy(desc(freeDeliveryVouchers.createdAt));
}

export async function claimFreeDeliveryVoucher(input: { userId: number; voucherId: number; orderReference: string }) {
  const db = await requireDb();
  const claim = await db.update(freeDeliveryVouchers).set({ status: "redeemed", redeemedAt: new Date(), redeemedOrderReference: input.orderReference }).where(and(eq(freeDeliveryVouchers.id, input.voucherId), eq(freeDeliveryVouchers.userId, input.userId), eq(freeDeliveryVouchers.status, "active")));
  if (affectedRows(claim) !== 1) throw new Error("That free-delivery voucher is no longer available.");
}

export async function grantKycCompletionBonus(userId: number) {
  const db = await requireDb();
  return db.transaction(async tx => {
    const profile = (await tx.select().from(kycProfiles).where(eq(kycProfiles.userId, userId)).limit(1))[0];
    if (profile?.status !== "verified") return { granted: false, reason: "identity_not_verified" as const };
    await tx.insert(wallets).values({ userId }).onDuplicateKeyUpdate({ set: { userId: sql`${wallets.userId}` } });
    const wallet = (await tx.select().from(wallets).where(eq(wallets.userId, userId)).limit(1))[0];
    if (!wallet) throw new Error("KYC reward wallet could not be provisioned.");
    const key = `kyc-completion-${userId}`;
    await tx.insert(rewardGrants).values({ walletId: wallet.id, userId, type: "kyc_completion", amount: KYC_COMPLETION_BONUS, status: "released", releasedAt: new Date(), idempotencyKey: key }).onDuplicateKeyUpdate({ set: { idempotencyKey: sql`${rewardGrants.idempotencyKey}` } });
    const existing = await tx.select().from(walletTransactions).where(eq(walletTransactions.idempotencyKey, key)).limit(1);
    if (!existing.length) {
      await tx.update(wallets).set({ bonusBalance: sql`${wallets.bonusBalance} + ${KYC_COMPLETION_BONUS}` }).where(eq(wallets.id, wallet.id));
      const after = (await tx.select().from(wallets).where(eq(wallets.id, wallet.id)).limit(1))[0];
      if (!after) throw new Error("KYC reward wallet was not found.");
      await tx.insert(walletTransactions).values({ walletId: wallet.id, userId, type: "reward_bonus", direction: "in", status: "released", amount: KYC_COMPLETION_BONUS, balanceBucket: "bonus", balanceAfter: after.bonusBalance, reference: "kyc-completion", idempotencyKey: key, description: "KYC completion shopping bonus released" });
    }
    return { granted: true, amount: KYC_COMPLETION_BONUS };
  });
}

export async function getBuyerRewardSummary(userId: number) {
  const db = await requireDb();
  const month = rewardMonthKey();
  const { start, end } = rewardMonthRange(month);
  const [kyc, referrals, delivered, vouchers, pending] = await Promise.all([getKycProfileForUser(userId), listReferralSharesForUser(userId), db.select({ total: orders.total }).from(orders).where(and(eq(orders.buyerUserId, userId), eq(orders.fulfillmentStatus, "delivered"), gte(orders.deliveredAt, start), lt(orders.deliveredAt, end))), listActiveFreeDeliveryVouchers(userId), listPendingBonusRewardsForUser(userId)]);
  const monthlySpend = delivered.reduce((total, order) => total + order.total, 0);
  return { kycStatus: kyc?.status ?? "not_started", kycBonusAmount: KYC_COMPLETION_BONUS, monthlySpend, freeDeliveryThreshold: FREE_DELIVERY_MONTHLY_THRESHOLD, activeVouchers: vouchers, referrals, pending };
}

export type VendorRewardMetric = { vendorUserId: number; deliveries: number; returns: number };

export async function listMonthlyApprovedVendorMetrics(month = rewardMonthKey()) {
  const db = await requireDb();
  const { start, end } = rewardMonthRange(month);
  const [approved, deliveredOrders, returnedOrders] = await Promise.all([
    db.select({ userId: vendorApplications.userId, storeName: vendorApplications.storeName }).from(vendorApplications).where(eq(vendorApplications.status, "approved")),
    db.select({ orderLines: orders.orderLines }).from(orders).where(and(eq(orders.fulfillmentStatus, "delivered"), gte(orders.deliveredAt, start), lt(orders.deliveredAt, end))),
    db.select({ orderLines: orders.orderLines }).from(orders).where(and(eq(orders.fulfillmentStatus, "returned"), gte(orders.returnedAt, start), lt(orders.returnedAt, end))),
  ]);
  const approvedByUserId = new Map(approved.map(vendor => [vendor.userId, vendor.storeName]));
  const metrics = new Map<number, VendorRewardMetric>();
  for (const order of deliveredOrders) for (const userId of Array.from(new Set(order.orderLines.flatMap(line => line.vendorUserId ? [line.vendorUserId] : [])))) {
    if (!approvedByUserId.has(userId)) continue;
    const metric = metrics.get(userId) ?? { vendorUserId: userId, deliveries: 0, returns: 0 };
    metric.deliveries += 1; metrics.set(userId, metric);
  }
  for (const order of returnedOrders) for (const userId of Array.from(new Set(order.orderLines.flatMap(line => line.vendorUserId ? [line.vendorUserId] : [])))) {
    if (!approvedByUserId.has(userId)) continue;
    const metric = metrics.get(userId) ?? { vendorUserId: userId, deliveries: 0, returns: 0 };
    metric.returns += 1; metrics.set(userId, metric);
  }
  return Array.from(metrics.values()).map(metric => ({ ...metric, storeName: approvedByUserId.get(metric.vendorUserId) ?? "Approved vendor" })).sort((a, b) => b.deliveries - a.deliveries || a.returns - b.returns || a.storeName.localeCompare(b.storeName));
}

export async function getVendorRewardSummary(userId: number) {
  const db = await requireDb();
  const month = rewardMonthKey();
  const [application, profile, leaderboard, overrides] = await Promise.all([
    getVendorApplicationForUser(userId), db.select().from(vendorRewardProfiles).where(eq(vendorRewardProfiles.vendorUserId, userId)).limit(1), listMonthlyApprovedVendorMetrics(month), db.select().from(vendorCommissionOverrides).where(and(eq(vendorCommissionOverrides.vendorUserId, userId), eq(vendorCommissionOverrides.rewardMonth, month))).limit(1),
  ]);
  const metrics = leaderboard.find(metric => metric.vendorUserId === userId) ?? { vendorUserId: userId, deliveries: 0, returns: 0, storeName: application?.storeName ?? "Your store" };
  return { month, vendor: application ? { status: application.status, storeName: application.storeName } : null, metrics, leaderboard: leaderboard.slice(0, 5), hasLightningSellerBadge: Boolean(profile[0]?.hasLightningSellerBadge), commissionOverride: overrides[0] ? { rate: overrides[0].commissionRate, qualifyingDeliveries: overrides[0].qualifyingDeliveries } : null };
}

export async function recordVerifiedVendorDispatch(input: { reference: string; vendorUserId: number; dispatchedAt: Date }) {
  const db = await requireDb();
  return db.transaction(async tx => {
    const [order, vendor] = await Promise.all([
      tx.select().from(orders).where(eq(orders.reference, input.reference)).limit(1),
      tx.select().from(vendorApplications).where(and(eq(vendorApplications.userId, input.vendorUserId), eq(vendorApplications.status, "approved"))).limit(1),
    ]);
    if (!order[0] || !vendor[0] || !order[0].orderLines.some(line => line.vendorUserId === input.vendorUserId)) throw new Error("A verified dispatch can only be recorded for an approved vendor’s order line.");
    const onTime = input.dispatchedAt.getTime() <= order[0].createdAt.getTime() + 24 * 60 * 60 * 1000;
    await tx.insert(vendorDispatchEvents).values({ orderReference: input.reference, vendorUserId: input.vendorUserId, dispatchedAt: input.dispatchedAt, onTime: onTime ? 1 : 0, idempotencyKey: `dispatch-${input.reference}-${input.vendorUserId}` }).onDuplicateKeyUpdate({ set: { idempotencyKey: sql`${vendorDispatchEvents.idempotencyKey}` } });
    if (!onTime) return { onTime: false, awarded: false };
    await tx.insert(vendorRewardProfiles).values({ vendorUserId: input.vendorUserId, hasLightningSellerBadge: 1, lightningBadgeAwardedAt: input.dispatchedAt }).onDuplicateKeyUpdate({ set: { hasLightningSellerBadge: 1, lightningBadgeAwardedAt: input.dispatchedAt } });
    const wallet = (await tx.select().from(wallets).where(eq(wallets.userId, input.vendorUserId)).limit(1))[0] ?? await (async () => { await tx.insert(wallets).values({ userId: input.vendorUserId }); return (await tx.select().from(wallets).where(eq(wallets.userId, input.vendorUserId)).limit(1))[0]; })();
    if (!wallet) throw new Error("Vendor reward wallet could not be provisioned.");
    const key = `lightning-dispatch-${input.reference}-${input.vendorUserId}`;
    await tx.insert(rewardGrants).values({ walletId: wallet.id, userId: input.vendorUserId, type: "vendor_dispatch", amount: LIGHTNING_SELLER_BONUS, status: "released", sourceOrderReference: input.reference, releasedAt: new Date(), idempotencyKey: key }).onDuplicateKeyUpdate({ set: { idempotencyKey: sql`${rewardGrants.idempotencyKey}` } });
    const existing = await tx.select().from(walletTransactions).where(eq(walletTransactions.idempotencyKey, key)).limit(1);
    if (!existing.length) {
      await tx.update(wallets).set({ bonusBalance: sql`${wallets.bonusBalance} + ${LIGHTNING_SELLER_BONUS}` }).where(eq(wallets.id, wallet.id));
      const after = (await tx.select().from(wallets).where(eq(wallets.id, wallet.id)).limit(1))[0];
      if (!after) throw new Error("Vendor reward wallet was not found.");
      await tx.insert(walletTransactions).values({ walletId: wallet.id, userId: input.vendorUserId, type: "reward_bonus", direction: "in", status: "released", amount: LIGHTNING_SELLER_BONUS, balanceBucket: "bonus", balanceAfter: after.bonusBalance, reference: `dispatch-${input.reference}`, idempotencyKey: key, orderReference: input.reference, description: "Lightning Seller shopping bonus released" });
    }
    return { onTime: true, awarded: true, amount: LIGHTNING_SELLER_BONUS };
  });
}

export async function evaluateMonthlyVendorRewards(month: string) {
  const db = await requireDb();
  const metrics = await listMonthlyApprovedVendorMetrics(month);
  return db.transaction(async tx => {
    const { end } = rewardMonthRange(month);
    const releaseAt = new Date(end.getTime() + 48 * 60 * 60 * 1000);
    let pendingPayouts = 0;
    for (let index = 0; index < metrics.slice(0, 5).length; index += 1) {
      const metric = metrics[index]!;
      const wallet = (await tx.select().from(wallets).where(eq(wallets.userId, metric.vendorUserId)).limit(1))[0];
      if (!wallet) { await tx.insert(wallets).values({ userId: metric.vendorUserId }); }
      const ensured = wallet ?? (await tx.select().from(wallets).where(eq(wallets.userId, metric.vendorUserId)).limit(1))[0];
      if (!ensured) throw new Error("Leaderboard wallet could not be provisioned.");
      await tx.insert(rewardGrants).values({ walletId: ensured.id, userId: metric.vendorUserId, type: "vendor_leaderboard", amount: LEADERBOARD_BONUSES[index] ?? 0, status: "pending", rewardMonth: month, releaseAt, idempotencyKey: `vendor-leaderboard-${month}-${metric.vendorUserId}` }).onDuplicateKeyUpdate({ set: { idempotencyKey: sql`${rewardGrants.idempotencyKey}` } });
      pendingPayouts += 1;
    }
    for (const metric of metrics.filter(metric => metric.deliveries >= 50 && metric.returns === 0)) await tx.insert(vendorCommissionOverrides).values({ vendorUserId: metric.vendorUserId, rewardMonth: month, commissionRate: 0, qualifyingDeliveries: metric.deliveries, idempotencyKey: `zero-commission-${month}-${metric.vendorUserId}` }).onDuplicateKeyUpdate({ set: { idempotencyKey: sql`${vendorCommissionOverrides.idempotencyKey}` } });
    return { pendingPayouts, commissionOverrides: metrics.filter(metric => metric.deliveries >= 50 && metric.returns === 0).length, releaseAt };
  });
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

export type SavedProductStatusFilter = "draft" | "active" | "rejected";

export type SavedProductListOptions = {
  status?: SavedProductStatusFilter;
  category?: MarketplaceCategory;
  search?: string;
  page?: number;
  pageSize?: number;
};

export const MAX_SAVED_PRODUCTS_PAGE_SIZE = 100;

function normalizeSavedProductListOptions(options: SavedProductListOptions = {}) {
  const pageSize = Math.min(MAX_SAVED_PRODUCTS_PAGE_SIZE, Math.max(1, Math.floor(options.pageSize ?? 25)));
  const requestedPage = Math.max(1, Math.floor(options.page ?? 1));
  const search = options.search?.trim().slice(0, 120) ?? "";
  return { ...options, search, pageSize, requestedPage };
}

function savedProductSearchPattern(search: string) {
  return `%${search.replace(/[\\%_]/g, "\\$&")}%`;
}

export async function listVendorProducts(vendorApplicationId: number, options: SavedProductListOptions = {}) {
  const db = await requireDb();
  const normalized = normalizeSavedProductListOptions(options);
  const conditions = [eq(vendorProducts.vendorApplicationId, vendorApplicationId)];
  if (normalized.status) conditions.push(eq(vendorProducts.status, normalized.status));
  if (normalized.category) conditions.push(eq(vendorProducts.category, normalized.category));
  if (normalized.search) conditions.push(like(vendorProducts.title, savedProductSearchPattern(normalized.search)));
  const whereClause = and(...conditions);
  const [{ total }] = await db.select({ total: count() }).from(vendorProducts).where(whereClause);
  const totalProducts = Number(total);
  const totalPages = Math.max(1, Math.ceil(totalProducts / normalized.pageSize));
  const page = Math.min(normalized.requestedPage, totalPages);
  const items = await db
    .select()
    .from(vendorProducts)
    .where(whereClause)
    .orderBy(desc(vendorProducts.createdAt), desc(vendorProducts.id))
    .limit(normalized.pageSize)
    .offset((page - 1) * normalized.pageSize);
  return { items, total: totalProducts, page, pageSize: normalized.pageSize, totalPages };
}

export async function getVendorProductForApplication(id: number, vendorApplicationId: number) {
  const db = await requireDb();
  const result = await db.select().from(vendorProducts).where(and(eq(vendorProducts.id, id), eq(vendorProducts.vendorApplicationId, vendorApplicationId))).limit(1);
  return result[0];
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
      vendorUserId: vendorApplications.userId,
      commissionRate: vendorApplications.commissionRate,
      lightningSeller: vendorRewardProfiles.hasLightningSellerBadge,
    })
    .from(vendorProducts)
    .innerJoin(vendorApplications, eq(vendorProducts.vendorApplicationId, vendorApplications.id))
    .leftJoin(vendorRewardProfiles, eq(vendorRewardProfiles.vendorUserId, vendorApplications.userId))
    .where(and(eq(vendorProducts.status, "active"), eq(vendorApplications.status, "approved")))
    .orderBy(desc(vendorProducts.createdAt));
}

export async function getCurrentVendorCommissionRate(vendorUserId: number, baseRate: number) {
  const db = await requireDb();
  const override = (await db.select().from(vendorCommissionOverrides).where(and(eq(vendorCommissionOverrides.vendorUserId, vendorUserId), eq(vendorCommissionOverrides.rewardMonth, rewardMonthKey()))).limit(1))[0];
  return override?.commissionRate ?? baseRate;
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

export async function updateVendorDraftProduct(
  id: number,
  update: Pick<InsertVendorProduct, "title" | "category" | "price" | "description" | "imageUrl" | "imageUrls">,
) {
  const db = await requireDb();
  await db.update(vendorProducts).set(update).where(eq(vendorProducts.id, id));
}

export async function updateVendorProductStatus(id: number, status: "draft" | "active" | "rejected") {
  const db = await requireDb();
  await db.update(vendorProducts).set({ status }).where(eq(vendorProducts.id, id));
}

export type OfficialProductInput = {
  title: string;
  category: (typeof import("../shared/marketplace"))["MARKETPLACE_CATEGORIES"][number];
  price: number;
  formerPrice?: number | null;
  badge?: string | null;
  description: string;
  detail: string;
  aiCleanTitle?: string | null;
  aiSeoDescription?: string | null;
  aiMetaDescription?: string | null;
  aiSuggestedTags?: string[] | null;
  aiEnhancedAt?: Date | null;
  imageUrls: string[];
  status: "draft" | "active" | "rejected";
  stockQuantity?: number | null;
  inventorySyncStatus?: "not_managed" | "current" | "stale" | "error";
  inventorySyncedAt?: Date | null;
  sourcing: {
    fulfillmentProvider: "local_vendor" | "auto_fulfill_api" | "manual_admin";
    externalSkuId?: string | null;
    externalProductId?: string | null;
    externalVariantId?: string | null;
    supplierCost?: string | null;
    supplierProductCost?: string | null;
    supplierShippingCost?: string | null;
    supplierInventoryQuantity?: number | null;
    supplierInventoryCountryCode?: string | null;
    supplierCurrency: "NGN" | "USD";
  };
};

export async function listActiveOfficialProducts() {
  const db = await requireDb();
  return db.select({
    id: officialProducts.id,
    title: officialProducts.title,
    category: officialProducts.category,
    price: officialProducts.price,
    formerPrice: officialProducts.formerPrice,
    badge: officialProducts.badge,
    description: officialProducts.description,
    detail: officialProducts.detail,
    imageUrl: officialProducts.imageUrl,
    imageUrls: officialProducts.imageUrls,
    stockQuantity: officialProducts.stockQuantity,
  }).from(officialProducts).where(eq(officialProducts.status, "active")).orderBy(desc(officialProducts.createdAt));
}

export async function listActiveOfficialProductsWithSourcing() {
  const db = await requireDb();
  return db.select({
    id: officialProducts.id,
    title: officialProducts.title,
    category: officialProducts.category,
    price: officialProducts.price,
    formerPrice: officialProducts.formerPrice,
    badge: officialProducts.badge,
    description: officialProducts.description,
    detail: officialProducts.detail,
    imageUrl: officialProducts.imageUrl,
    imageUrls: officialProducts.imageUrls,
    stockQuantity: officialProducts.stockQuantity,
    fulfillmentProvider: officialProductSourcing.fulfillmentProvider,
    externalSkuId: officialProductSourcing.externalSkuId,
  }).from(officialProducts).leftJoin(officialProductSourcing, eq(officialProductSourcing.officialProductId, officialProducts.id)).where(eq(officialProducts.status, "active")).orderBy(desc(officialProducts.createdAt));
}

export async function listAdminOfficialProducts(options: SavedProductListOptions = {}) {
  const db = await requireDb();
  const normalized = normalizeSavedProductListOptions(options);
  const conditions = [] as ReturnType<typeof eq>[];
  if (normalized.status) conditions.push(eq(officialProducts.status, normalized.status));
  if (normalized.category) conditions.push(eq(officialProducts.category, normalized.category));
  if (normalized.search) conditions.push(like(officialProducts.title, savedProductSearchPattern(normalized.search)));
  const whereClause = and(...conditions);
  const [{ total }] = await db.select({ total: count() }).from(officialProducts).where(whereClause);
  const totalProducts = Number(total);
  const totalPages = Math.max(1, Math.ceil(totalProducts / normalized.pageSize));
  const page = Math.min(normalized.requestedPage, totalPages);
  const items = await db.select({
    id: officialProducts.id,
    title: officialProducts.title,
    category: officialProducts.category,
    price: officialProducts.price,
    formerPrice: officialProducts.formerPrice,
    badge: officialProducts.badge,
    description: officialProducts.description,
    detail: officialProducts.detail,
    aiCleanTitle: officialProducts.aiCleanTitle,
    aiSeoDescription: officialProducts.aiSeoDescription,
    aiMetaDescription: officialProducts.aiMetaDescription,
    aiSuggestedTags: officialProducts.aiSuggestedTags,
    aiEnhancedAt: officialProducts.aiEnhancedAt,
    imageUrl: officialProducts.imageUrl,
    imageUrls: officialProducts.imageUrls,
    status: officialProducts.status,
    stockQuantity: officialProducts.stockQuantity,
    inventorySyncedAt: officialProducts.inventorySyncedAt,
    inventorySyncStatus: officialProducts.inventorySyncStatus,
    createdAt: officialProducts.createdAt,
    updatedAt: officialProducts.updatedAt,
    sourcingId: officialProductSourcing.id,
    fulfillmentProvider: officialProductSourcing.fulfillmentProvider,
    externalSkuId: officialProductSourcing.externalSkuId,
    externalProductId: officialProductSourcing.externalProductId,
    externalVariantId: officialProductSourcing.externalVariantId,
    supplierCost: officialProductSourcing.supplierCost,
    supplierProductCost: officialProductSourcing.supplierProductCost,
    supplierShippingCost: officialProductSourcing.supplierShippingCost,
    supplierInventoryQuantity: officialProductSourcing.supplierInventoryQuantity,
    supplierInventoryCountryCode: officialProductSourcing.supplierInventoryCountryCode,
    supplierCurrency: officialProductSourcing.supplierCurrency,
  }).from(officialProducts)
    .leftJoin(officialProductSourcing, eq(officialProductSourcing.officialProductId, officialProducts.id))
    .where(whereClause)
    .orderBy(desc(officialProducts.createdAt), desc(officialProducts.id))
    .limit(normalized.pageSize)
    .offset((page - 1) * normalized.pageSize);
  return { items, total: totalProducts, page, pageSize: normalized.pageSize, totalPages };
}

export async function getOfficialProductWithSourcing(id: number) {
  const db = await requireDb();
  const results = await db.select({
    id: officialProducts.id,
    title: officialProducts.title,
    category: officialProducts.category,
    price: officialProducts.price,
    formerPrice: officialProducts.formerPrice,
    badge: officialProducts.badge,
    description: officialProducts.description,
    detail: officialProducts.detail,
    imageUrl: officialProducts.imageUrl,
    imageUrls: officialProducts.imageUrls,
    status: officialProducts.status,
    fulfillmentProvider: officialProductSourcing.fulfillmentProvider,
    externalSkuId: officialProductSourcing.externalSkuId,
    supplierCost: officialProductSourcing.supplierCost,
    supplierCurrency: officialProductSourcing.supplierCurrency,
  }).from(officialProducts).leftJoin(officialProductSourcing, eq(officialProductSourcing.officialProductId, officialProducts.id)).where(eq(officialProducts.id, id)).limit(1);
  return results[0];
}

export async function createOfficialProduct(input: OfficialProductInput) {
  const db = await requireDb();
  return db.transaction(async tx => {
    const productResult = await tx.insert(officialProducts).values({
      title: input.title,
      category: input.category,
      price: input.price,
      formerPrice: input.formerPrice ?? null,
      badge: input.badge ?? null,
      description: input.description,
      detail: input.detail,
      aiCleanTitle: input.aiCleanTitle ?? null,
      aiSeoDescription: input.aiSeoDescription ?? null,
      aiMetaDescription: input.aiMetaDescription ?? null,
      aiSuggestedTags: input.aiSuggestedTags ?? null,
      aiEnhancedAt: input.aiEnhancedAt ?? null,
      imageUrl: input.imageUrls[0] ?? null,
      imageUrls: input.imageUrls,
      status: input.status,
      stockQuantity: input.stockQuantity ?? null,
      inventorySyncedAt: input.inventorySyncedAt ?? null,
      inventorySyncStatus: input.inventorySyncStatus ?? "not_managed",
    });
    const id = Number(productResult[0].insertId);
    await tx.insert(officialProductSourcing).values({ officialProductId: id, ...input.sourcing });
    return id;
  });
}

export async function updateOfficialProduct(id: number, input: OfficialProductInput) {
  const db = await requireDb();
  return db.transaction(async tx => {
    await tx.update(officialProducts).set({
      title: input.title,
      category: input.category,
      price: input.price,
      formerPrice: input.formerPrice ?? null,
      badge: input.badge ?? null,
      description: input.description,
      detail: input.detail,
      ...(input.aiCleanTitle === undefined ? {} : { aiCleanTitle: input.aiCleanTitle }),
      ...(input.aiSeoDescription === undefined ? {} : { aiSeoDescription: input.aiSeoDescription }),
      ...(input.aiMetaDescription === undefined ? {} : { aiMetaDescription: input.aiMetaDescription }),
      ...(input.aiSuggestedTags === undefined ? {} : { aiSuggestedTags: input.aiSuggestedTags }),
      ...(input.aiEnhancedAt === undefined ? {} : { aiEnhancedAt: input.aiEnhancedAt }),
      imageUrl: input.imageUrls[0] ?? null,
      imageUrls: input.imageUrls,
      status: input.status,
      ...(input.stockQuantity === undefined ? {} : { stockQuantity: input.stockQuantity }),
      ...(input.inventorySyncedAt === undefined ? {} : { inventorySyncedAt: input.inventorySyncedAt }),
      ...(input.inventorySyncStatus === undefined ? {} : { inventorySyncStatus: input.inventorySyncStatus }),
    }).where(eq(officialProducts.id, id));
    await tx.insert(officialProductSourcing).values({ officialProductId: id, ...input.sourcing }).onDuplicateKeyUpdate({ set: input.sourcing });
  });
}

export async function getOfficialProductForGeminiEnhancement(id: number) {
  const db = await requireDb();
  const results = await db.select({
    id: officialProducts.id,
    title: officialProducts.title,
    description: officialProducts.description,
    detail: officialProducts.detail,
    status: officialProducts.status,
  }).from(officialProducts).where(eq(officialProducts.id, id)).limit(1);
  return results[0];
}

export async function saveOfficialProductGeminiEnhancement(id: number, enhancement: { cleanTitle: string; seoDescription: string; metaDescription: string; suggestedTags: string[] }) {
  const db = await requireDb();
  await db.update(officialProducts).set({
    aiCleanTitle: enhancement.cleanTitle,
    aiSeoDescription: enhancement.seoDescription,
    aiMetaDescription: enhancement.metaDescription,
    aiSuggestedTags: enhancement.suggestedTags,
    aiEnhancedAt: new Date(),
  }).where(eq(officialProducts.id, id));
}

export async function updateOfficialProductStatus(id: number, status: "draft" | "active" | "rejected") {
  const db = await requireDb();
  await db.update(officialProducts).set({ status }).where(eq(officialProducts.id, id));
}

export async function getFulfilmentIntegration(provider: "cj_dropshipping" | "custom_webhook") {
  const db = await requireDb();
  const results = await db.select().from(fulfilmentIntegrations).where(eq(fulfilmentIntegrations.provider, provider)).limit(1);
  return results[0];
}

export async function saveCjInventorySyncScheduleTaskUid(taskUid: string) {
  const db = await requireDb();
  await db.insert(fulfilmentIntegrations).values({ provider: "cj_dropshipping", enabled: 0, orderMode: "create_only", inventorySyncScheduleTaskUid: taskUid }).onDuplicateKeyUpdate({ set: { inventorySyncScheduleTaskUid: taskUid, inventorySyncLastError: null } });
}

export async function saveFulfilmentIntegration(input: {
  provider: "cj_dropshipping" | "custom_webhook";
  enabled: boolean;
  apiBaseUrl?: string | null;
  callbackUrl?: string | null;
  defaultLogisticsName?: string | null;
  defaultFromCountryCode?: string | null;
  orderMode: "create_only" | "balance_payment";
}) {
  const db = await requireDb();
  const values = { ...input, enabled: input.enabled ? 1 : 0 };
  await db.insert(fulfilmentIntegrations).values(values).onDuplicateKeyUpdate({ set: values });
  return getFulfilmentIntegration(input.provider);
}

export type FulfilmentJobInput = {
  orderReference: string;
  officialProductId: number;
  provider: "cj_dropshipping" | "custom_webhook";
  externalSkuSnapshot: string;
  quantity: number;
  deliverySnapshot: { buyerName: string; buyerPhone: string; deliveryAddress: string; countryCode: "NG"; state: string; lga: string; streetDetails: string };
  idempotencyKey: string;
};

export async function enqueueFulfilmentJobs(inputs: FulfilmentJobInput[]) {
  if (!inputs.length) return [];
  const db = await requireDb();
  for (const input of inputs) {
    await db.insert(fulfilmentJobs).values({ ...input, status: "queued" }).onDuplicateKeyUpdate({ set: { idempotencyKey: sql`${fulfilmentJobs.idempotencyKey}` } });
  }
  return db.select().from(fulfilmentJobs).where(eq(fulfilmentJobs.orderReference, inputs[0].orderReference));
}

export async function listAdminFulfilmentJobs() {
  const db = await requireDb();
  return db.select({
    id: fulfilmentJobs.id,
    orderReference: fulfilmentJobs.orderReference,
    officialProductId: fulfilmentJobs.officialProductId,
    productTitle: officialProducts.title,
    provider: fulfilmentJobs.provider,
    status: fulfilmentJobs.status,
    quantity: fulfilmentJobs.quantity,
    providerOrderId: fulfilmentJobs.providerOrderId,
    errorSummary: fulfilmentJobs.errorSummary,
    attemptCount: fulfilmentJobs.attemptCount,
    nextAttemptAt: fulfilmentJobs.nextAttemptAt,
    submittedAt: fulfilmentJobs.submittedAt,
    createdAt: fulfilmentJobs.createdAt,
  }).from(fulfilmentJobs).innerJoin(officialProducts, eq(officialProducts.id, fulfilmentJobs.officialProductId)).orderBy(desc(fulfilmentJobs.createdAt));
}

export async function markFulfilmentJobRetryQueued(id: number) {
  const db = await requireDb();
  await db.update(fulfilmentJobs).set({ status: "queued", errorSummary: null, nextAttemptAt: new Date(), claimedAt: null }).where(and(eq(fulfilmentJobs.id, id), eq(fulfilmentJobs.status, "manual_required")));
}

export async function claimDueFulfilmentJobs(limit = 10) {
  const db = await requireDb();
  const candidates = await db.select().from(fulfilmentJobs).where(or(eq(fulfilmentJobs.status, "queued"), and(eq(fulfilmentJobs.status, "retry_pending"), lte(fulfilmentJobs.nextAttemptAt, new Date())))).orderBy(fulfilmentJobs.createdAt).limit(limit);
  const claimed: typeof candidates = [];
  for (const candidate of candidates) {
    const claimedResult = await db.update(fulfilmentJobs).set({ status: "processing", claimedAt: new Date(), attemptCount: sql`${fulfilmentJobs.attemptCount} + 1` }).where(and(eq(fulfilmentJobs.id, candidate.id), eq(fulfilmentJobs.status, candidate.status)));
    if (affectedRows(claimedResult) === 1) claimed.push({ ...candidate, status: "processing", attemptCount: candidate.attemptCount + 1 });
  }
  return claimed;
}

export async function recoverStaleFulfilmentJobClaims(staleBefore: Date) {
  const db = await requireDb();
  await db.update(fulfilmentJobs).set({
    status: "retry_pending",
    claimedAt: null,
    nextAttemptAt: new Date(),
    errorSummary: "A previous dispatch attempt did not complete and was safely returned to the queue.",
  }).where(and(eq(fulfilmentJobs.status, "processing"), lt(fulfilmentJobs.claimedAt, staleBefore)));
}

export async function markFulfilmentJobSubmitted(input: { id: number; providerOrderId?: string | null; providerRequestId?: string | null }) {
  const db = await requireDb();
  await db.update(fulfilmentJobs).set({ status: "submitted", providerOrderId: input.providerOrderId ?? null, providerRequestId: input.providerRequestId ?? null, submittedAt: new Date(), errorSummary: null, nextAttemptAt: null }).where(and(eq(fulfilmentJobs.id, input.id), eq(fulfilmentJobs.status, "processing")));
}

export async function markFulfilmentJobFailed(input: { id: number; errorSummary: string; retryAt: Date | null }) {
  const db = await requireDb();
  await db.update(fulfilmentJobs).set({ status: input.retryAt ? "retry_pending" : "manual_required", errorSummary: input.errorSummary.slice(0, 255), nextAttemptAt: input.retryAt, claimedAt: null }).where(and(eq(fulfilmentJobs.id, input.id), eq(fulfilmentJobs.status, "processing")));
}
