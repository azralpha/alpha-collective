import { and, desc, eq, gte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  type InsertOrder,
  type InsertReferralShare,
  type InsertUser,
  type InsertVendorApplication,
  type InsertVendorProduct,
  type InsertWalletTransaction,
  escrowAllocations,
  orders,
  referralShares,
  users,
  vendorApplications,
  vendorProducts,
  walletBankRecipients,
  walletFundingAttempts,
  walletTransactions,
  wallets,
  withdrawalRequests,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { fundingCreditDisposition, withdrawalPaidDisposition, withdrawalRestoreDisposition } from "./walletReconciliation";

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

export async function createOrder(order: InsertOrder) {
  const db = await requireDb();
  await db.insert(orders).values(order);
  return order.reference;
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

export async function getWalletBankRecipientForUser(userId: number) {
  const db = await requireDb();
  const result = await db.select().from(walletBankRecipients).where(eq(walletBankRecipients.userId, userId)).limit(1);
  return result[0];
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
  await db.insert(walletBankRecipients).values(input).onDuplicateKeyUpdate({ set: {
    bankCode: input.bankCode,
    bankName: input.bankName,
    accountNumberMasked: input.accountNumberMasked,
    accountName: input.accountName,
    paystackRecipientCode: input.paystackRecipientCode,
    verifiedAt: new Date(),
  } });
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

export async function createWalletFundingAttempt(input: { walletId: number; userId: number; reference: string; amount: number }) {
  const db = await requireDb();
  await db.insert(walletFundingAttempts).values({ ...input, status: "pending" });
  const attempt = await getWalletFundingAttemptByReference(input.reference);
  if (!attempt) throw new Error("Wallet funding attempt could not be created.");
  return attempt;
}

export async function markWalletFundingAttemptFailed(reference: string) {
  const db = await requireDb();
  await db.update(walletFundingAttempts).set({ status: "failed" }).where(and(eq(walletFundingAttempts.reference, reference), eq(walletFundingAttempts.status, "pending")));
}

export async function creditVerifiedWalletFunding(input: { reference: string; providerTransactionId: string }) {
  const db = await requireDb();
  return db.transaction(async tx => {
    const attemptResult = await tx.select().from(walletFundingAttempts).where(eq(walletFundingAttempts.reference, input.reference)).limit(1);
    const attempt = attemptResult[0];
    if (!attempt) throw new Error("Wallet funding attempt was not found.");
    const fundingDisposition = fundingCreditDisposition(attempt.status);
    if (fundingDisposition === "ignore_duplicate") return { attempt, alreadyProcessed: true } as const;
    if (fundingDisposition === "reject") throw new Error("Wallet funding attempt is not eligible for crediting.");
    const stateUpdate = await tx.update(walletFundingAttempts).set({ status: "succeeded", providerTransactionId: input.providerTransactionId, paidAt: new Date() }).where(and(eq(walletFundingAttempts.id, attempt.id), eq(walletFundingAttempts.status, "pending")));
    if (affectedRows(stateUpdate) !== 1) return { attempt, alreadyProcessed: true } as const;
    const walletResult = await tx.select().from(wallets).where(eq(wallets.id, attempt.walletId)).limit(1);
    const wallet = walletResult[0];
    if (!wallet || wallet.userId !== attempt.userId) throw new Error("Wallet funding attempt has an invalid wallet owner.");
    await tx.update(wallets).set({ availableBalance: sql`${wallets.availableBalance} + ${attempt.amount}` }).where(eq(wallets.id, wallet.id));
    const walletAfter = (await tx.select().from(wallets).where(eq(wallets.id, wallet.id)).limit(1))[0];
    if (!walletAfter) throw new Error("Wallet funding balance could not be loaded.");
    await tx.insert(walletTransactions).values({
      walletId: wallet.id,
      userId: attempt.userId,
      type: "deposit",
      direction: "in",
      status: "completed",
      amount: attempt.amount,
      balanceAfter: walletAfter.availableBalance,
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
    const debitResult = await tx.update(wallets).set({ availableBalance: sql`${wallets.availableBalance} - ${input.amount}` }).where(and(eq(wallets.id, wallet.id), gte(wallets.availableBalance, input.amount)));
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
      balanceAfter: walletAfter.availableBalance,
      reference: input.transferReference,
      idempotencyKey: `wallet-withdrawal-${input.transferReference}`,
      description: "Paystack bank withdrawal requested",
    });
    return { id: requestId, walletId: wallet.id, balanceAfter: walletAfter.availableBalance };
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
  await tx.update(wallets).set({ availableBalance: sql`${wallets.availableBalance} + ${input.amount}` }).where(eq(wallets.id, input.walletId));
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
    balanceAfter: walletAfter.availableBalance,
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
}) {
  const db = await requireDb();
  return db.transaction(async tx => {
    await tx.insert(wallets).values({ userId: input.buyerUserId }).onDuplicateKeyUpdate({ set: { userId: sql`${wallets.userId}` } });
    const walletResult = await tx.select().from(wallets).where(eq(wallets.userId, input.buyerUserId)).limit(1);
    const wallet = walletResult[0];
    if (!wallet) throw new Error("Wallet was not found.");

    const debitResult = await tx
      .update(wallets)
      .set({
        availableBalance: sql`${wallets.availableBalance} - ${input.order.total}`,
        escrowBalance: sql`${wallets.escrowBalance} + ${input.order.total}`,
      })
      .where(and(eq(wallets.id, wallet.id), gte(wallets.availableBalance, input.order.total)));
    if (affectedRows(debitResult) !== 1) throw new Error("INSUFFICIENT_WALLET_BALANCE");

    await tx.insert(orders).values(input.order);
    const walletAfterDebit = await tx.select().from(wallets).where(eq(wallets.id, wallet.id)).limit(1);
    const balanceAfter = walletAfterDebit[0]?.availableBalance ?? 0;
    const buyerTransaction: InsertWalletTransaction = {
      walletId: wallet.id,
      userId: input.buyerUserId,
      type: "purchase_escrow",
      direction: "out",
      status: "held",
      amount: input.order.total,
      balanceAfter,
      reference: input.order.reference,
      idempotencyKey: `wallet-order-${input.order.reference}`,
      orderReference: input.order.reference,
      description: `Escrow held for order ${input.order.reference}`,
    };
    await tx.insert(walletTransactions).values(buyerTransaction);

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
    return { wallet, balanceAfter };
  });
}

export async function releaseWalletEscrowOrder(reference: string) {
  const db = await requireDb();
  return db.transaction(async tx => {
    const orderResult = await tx.select().from(orders).where(eq(orders.reference, reference)).limit(1);
    const order = orderResult[0];
    if (!order) throw new Error("Order was not found.");
    if (order.paymentMethod !== "wallet" || order.paymentStatus !== "wallet_escrow") throw new Error("This order does not have held wallet escrow.");
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
      await tx.update(wallets).set({ availableBalance: sql`${wallets.availableBalance} + ${allocation.netAmount}` }).where(eq(wallets.userId, allocation.vendorUserId));
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
        balanceAfter: vendorWallet.availableBalance,
        reference,
        idempotencyKey: `wallet-release-${reference}-${allocation.id}`,
        orderReference: reference,
        description: `Sale earning released for order ${reference}`,
      });
      releasedVendors.push({ userId: allocation.vendorUserId, amount: allocation.netAmount });
    }
    await tx.update(orders).set({ fulfillmentStatus: "delivered", paymentStatus: "wallet_released" }).where(eq(orders.reference, reference));
    return { order, releasedVendors };
  });
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
