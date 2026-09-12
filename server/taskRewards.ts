import { createHmac, timingSafeEqual } from "node:crypto";
import { and, desc, eq, gte, isNotNull, lte, sql } from "drizzle-orm";
import { taskTransactions, wallets, walletTransactions } from "../drizzle/schema";
import { getDb, getWalletForUser } from "./db";
import type { Request } from "express";

const HOLD_THRESHOLD_NAIRA = Number(process.env.TASK_REWARD_HOLD_THRESHOLD_NAIRA ?? 3_000);
const HOLD_HOURS = 24;

function requireDb() { return getDb().then(db => { if (!db) throw new Error("The marketplace database is not available."); return db; }); }
export function taskRewardSignature(rawBody: Buffer | string, secret = process.env.TASK_REWARDS_WEBHOOK_SECRET ?? "") { return createHmac("sha256", secret).update(rawBody).digest("hex"); }
export function verifyTaskRewardSignature(rawBody: Buffer | string, signature: string | undefined, secret = process.env.TASK_REWARDS_WEBHOOK_SECRET ?? "") {
  if (!signature || !secret) return false;
  const expected = Buffer.from(taskRewardSignature(rawBody, secret));
  const received = Buffer.from(signature);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function screenTaskTraffic(req: Pick<Request, "headers" | "ip" | "socket">) {
  const ip = req.ip ?? req.socket.remoteAddress ?? "";
  const blockedIps = new Set((process.env.TASK_REWARDS_BLOCKED_IPS ?? "").split(",").map(value => value.trim()).filter(Boolean));
  const edgeRisk = String(req.headers["x-task-network-risk"] ?? "").toLowerCase();
  return !blockedIps.has(ip) && !["vpn", "proxy", "datacenter", "tor"].includes(edgeRisk);
}

export type TaskRewardPayload = { transactionId: string; userId: number; provider: string; taskName?: string; payoutAmount: number; status?: "completed" | "pending" | "reversed" };
export async function settleTaskReward(input: TaskRewardPayload) {
  if (!input.transactionId || !Number.isInteger(input.userId) || !input.provider || !Number.isSafeInteger(input.payoutAmount) || input.payoutAmount === 0) throw new Error("Invalid task reward payload.");
  const db = await requireDb();
  const existing = await db.select().from(taskTransactions).where(eq(taskTransactions.externalTxId, input.transactionId)).limit(1);
  if (existing[0]) return { duplicate: true, transaction: existing[0] };
  if (input.status === "reversed" || input.payoutAmount < 0) return { duplicate: false, transaction: null, ignored: true };
  const amount = Math.abs(input.payoutAmount);
  const holdUntil = amount >= HOLD_THRESHOLD_NAIRA ? new Date(Date.now() + HOLD_HOURS * 60 * 60 * 1000) : null;
  const status = holdUntil ? "PENDING" : "COMPLETED";
  const result = await db.transaction(async tx => {
    const [wallet] = await tx.select().from(wallets).where(eq(wallets.userId, input.userId)).limit(1);
    if (!wallet) throw new Error("User wallet was not found.");
    const inserted = await tx.insert(taskTransactions).values({ userId: input.userId, provider: input.provider.slice(0, 80), externalTxId: input.transactionId.slice(0, 160), taskName: input.taskName?.slice(0, 180), payoutAmount: amount, status, holdUntil }).$returningId();
    const transactionId = Number(inserted[0].id);
    if (status === "COMPLETED") {
      const after = wallet.bonusBalance + amount;
      await tx.update(wallets).set({ bonusBalance: sql`${wallets.bonusBalance} + ${amount}` }).where(eq(wallets.id, wallet.id));
      await tx.insert(walletTransactions).values({ walletId: wallet.id, userId: input.userId, type: "reward_bonus", direction: "in", status: "released", amount, balanceBucket: "bonus", balanceAfter: after, reference: `task-${transactionId}`, idempotencyKey: `task-credit-${input.transactionId}`, description: `Task reward from ${input.provider}` });
    }
    return transactionId;
  });
  return { duplicate: false, transactionId: result, status, holdUntil };
}

export async function reverseTaskReward(input: { transactionId: string }) {
  const db = await requireDb();
  return db.transaction(async tx => {
    const [task] = await tx.select().from(taskTransactions).where(eq(taskTransactions.externalTxId, input.transactionId)).limit(1);
    if (!task || task.status === "REVERSED") return { found: Boolean(task), alreadyReversed: Boolean(task) };
    const [wallet] = await tx.select().from(wallets).where(eq(wallets.userId, task.userId)).limit(1);
    if (!wallet) throw new Error("User wallet was not found.");
    if (task.status === "COMPLETED") {
      const after = wallet.bonusBalance - task.payoutAmount;
      await tx.update(wallets).set({ bonusBalance: sql`${wallets.bonusBalance} - ${task.payoutAmount}` }).where(eq(wallets.id, wallet.id));
      await tx.insert(walletTransactions).values({ walletId: wallet.id, userId: task.userId, type: "reward_bonus", direction: "out", status: "reversed", amount: task.payoutAmount, balanceBucket: "bonus", balanceAfter: after, reference: `task-reversal-${task.id}`, idempotencyKey: `task-reversal-${task.externalTxId}`, description: `Reversed task reward from ${task.provider}` });
    }
    await tx.update(taskTransactions).set({ status: "REVERSED" }).where(and(eq(taskTransactions.id, task.id), sql`${taskTransactions.status} <> 'REVERSED'`));
    return { found: true, alreadyReversed: false, userId: task.userId, spendableBalanceAfter: task.status === "COMPLETED" ? wallet.bonusBalance - task.payoutAmount : wallet.bonusBalance };
  });
}

export async function releaseMatureTaskRewards(limit = 100) {
  const db = await requireDb();
  const now = new Date();
  const tasks = await db.select().from(taskTransactions).where(and(eq(taskTransactions.status, "PENDING"), isNotNull(taskTransactions.holdUntil), lte(taskTransactions.holdUntil, now))).orderBy(taskTransactions.holdUntil).limit(limit);
  let released = 0;
  for (const task of tasks) {
    await db.transaction(async tx => {
      const claimed = await tx.update(taskTransactions).set({ status: "COMPLETED" }).where(and(eq(taskTransactions.id, task.id), eq(taskTransactions.status, "PENDING")));
      if (!Number((claimed as any)[0]?.affectedRows ?? 0)) return;
      const [wallet] = await tx.select().from(wallets).where(eq(wallets.userId, task.userId)).limit(1);
      if (!wallet) return;
      const after = wallet.bonusBalance + task.payoutAmount;
      await tx.update(wallets).set({ bonusBalance: sql`${wallets.bonusBalance} + ${task.payoutAmount}` }).where(eq(wallets.id, wallet.id));
      await tx.insert(walletTransactions).values({ walletId: wallet.id, userId: task.userId, type: "reward_bonus", direction: "in", status: "released", amount: task.payoutAmount, balanceBucket: "bonus", balanceAfter: after, reference: `task-${task.id}`, idempotencyKey: `task-credit-${task.externalTxId}`, description: `Task reward from ${task.provider} released` }).onDuplicateKeyUpdate({ set: { idempotencyKey: sql`${walletTransactions.idempotencyKey}` } });
      released += 1;
    });
  }
  return { released };
}

export async function getTaskEarnDashboard(userId: number) {
  const db = await requireDb();
  const [wallet, tasks] = await Promise.all([
    getWalletForUser(userId),
    db.select().from(taskTransactions).where(eq(taskTransactions.userId, userId)).orderBy(desc(taskTransactions.createdAt)).limit(100),
  ]);
  const pendingCredit = tasks.filter(task => task.status === "PENDING").reduce((sum, task) => sum + task.payoutAmount, 0);
  return { availableCredit: wallet?.bonusBalance ?? 0, pendingCredit, tasks };
}
