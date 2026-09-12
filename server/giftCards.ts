import { createHash, randomBytes } from "node:crypto";
import { and, eq, gte, sql } from "drizzle-orm";
import { giftCardPurchases, giftCards, kycProfiles } from "../drizzle/schema";
import { getDb } from "./db";
import { initializeFlutterwavePayment, verifyFlutterwaveTransaction } from "./flutterwave";
import { FixedWindowRateLimiter } from "./performanceControls";

export const GIFT_CARD_AMOUNTS = [1_000, 10_000, 50_000] as const;
export const MAX_GIFT_CARD_AMOUNT = 50_000;
const failedRedemptionLimiter = new FixedWindowRateLimiter();
const failedRedemptionCounts = new Map<string, { count: number; expiresAt: number }>();

function requireDb() { return getDb().then(db => { if (!db) throw new Error("The marketplace database is not available."); return db; }); }
function normalizeCode(code: string) { return code.trim().toUpperCase().replace(/\s+/g, ""); }
export function hashGiftCardCode(code: string) { return createHash("sha256").update(normalizeCode(code)).digest("hex"); }
export function generateGiftCardCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const raw = Array.from(randomBytes(12), byte => alphabet[byte % alphabet.length]).join("");
  return `ALPHA-${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}`;
}
function recordFailedAttempt(ip: string) {
  const now = Date.now();
  const current = failedRedemptionCounts.get(ip);
  const next = current && current.expiresAt > now ? { count: current.count + 1, expiresAt: current.expiresAt } : { count: 1, expiresAt: now + 3_600_000 };
  failedRedemptionCounts.set(ip, next);
  return next.count;
}
export function failedRedemptionCount(ip: string) { const item = failedRedemptionCounts.get(ip); return item && item.expiresAt > Date.now() ? item.count : 0; }
export function checkGiftCardRedemptionRate(ip: string) {
  return failedRedemptionLimiter.consume({ key: `gift-card-redemption:ip:${ip}`, limit: 3, windowMs: 3_600_000 });
}
async function verifyCaptcha(token: string | undefined) {
  if (!token) return false;
  const secret = process.env.HCAPTCHA_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production" && token === "development-captcha";
  const response = await fetch("https://hcaptcha.com/siteverify", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ secret, response: token }) });
  const result = await response.json() as { success?: boolean };
  return result.success === true;
}

export async function initiateGiftCardPurchase(input: { userId: number; amount: number; purchaserEmail: string; recipientEmail: string; purchaserIp: string; redirectUrl: string }) {
  if (!GIFT_CARD_AMOUNTS.includes(input.amount as typeof GIFT_CARD_AMOUNTS[number]) || input.amount > MAX_GIFT_CARD_AMOUNT) throw new Error("Choose ₦1,000, ₦10,000, or ₦50,000. The maximum single purchase is ₦50,000.");
  const db = await requireDb();
  const [kyc] = await db.select({ status: kycProfiles.status }).from(kycProfiles).where(eq(kycProfiles.userId, input.userId)).limit(1);
  if (kyc?.status !== "verified") throw new Error("Gift-card purchases require a verified account.");
  const since = new Date(Date.now() - 86_400_000);
  const recent = await db.select({ count: sql<number>`count(*)` }).from(giftCardPurchases).where(and(sql`(${giftCardPurchases.purchaserUserId} = ${input.userId} OR ${giftCardPurchases.purchaserIp} = ${input.purchaserIp})`, gte(giftCardPurchases.createdAt, since), sql`${giftCardPurchases.status} <> 'FAILED'`));
  if (Number(recent[0]?.count ?? 0) >= 3) throw new Error("You can purchase up to 3 gift cards in a 24-hour period.");
  const reference = `ALPHA-GC-${Date.now()}-${randomBytes(4).toString("hex").toUpperCase()}`;
  await db.insert(giftCardPurchases).values({ reference, purchaserUserId: input.userId, purchaserIp: input.purchaserIp, amount: input.amount, purchaserEmail: input.purchaserEmail, recipientEmail: input.recipientEmail });
  try {
    return await initializeFlutterwavePayment({ email: input.purchaserEmail, reference, amountNaira: input.amount, redirectUrl: input.redirectUrl, title: "Alpha Market Gift Card" });
  } catch (error) {
    await db.update(giftCardPurchases).set({ status: "FAILED" }).where(eq(giftCardPurchases.reference, reference));
    throw error;
  }
}

async function sendGiftCardEmail(input: { recipientEmail: string; code: string; amount: number }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) { console.warn("[Gift card] Email delivery is not configured", { recipientEmail: input.recipientEmail }); return; }
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ from, to: [input.recipientEmail], subject: `Your Alpha Market ${input.amount.toLocaleString()} gift card`, text: `Your Alpha Market gift card is ready.\n\nCode: ${input.code}\nValue: ₦${input.amount.toLocaleString()}\n\nThis balance is non-refundable for cash and may only be used as Alpha Market store credit.` }) });
  if (!response.ok) throw new Error("Gift-card email delivery failed.");
}

export async function issueGiftCardFromFlutterwave(input: { transactionId: string }) {
  const verified = await verifyFlutterwaveTransaction(input.transactionId);
  const db = await requireDb();
  const [purchase] = await db.select().from(giftCardPurchases).where(eq(giftCardPurchases.reference, verified.reference)).limit(1);
  if (!purchase || purchase.status === "PAID") return null;
  if (verified.status !== "successful" || verified.currency !== "NGN" || verified.amountNaira !== purchase.amount) throw new Error("Gift-card payment verification did not match the stored purchase.");
  const code = generateGiftCardCode();
  const [inserted] = await db.insert(giftCards).values({ codeHash: hashGiftCardCode(code), initialBalance: purchase.amount, currentBalance: purchase.amount, purchaserEmail: purchase.purchaserEmail, recipientEmail: purchase.recipientEmail }).$returningId();
  await db.update(giftCardPurchases).set({ status: "PAID", providerTransactionId: verified.id, giftCardId: Number(inserted.id), paidAt: new Date() }).where(eq(giftCardPurchases.reference, purchase.reference));
  await sendGiftCardEmail({ recipientEmail: purchase.recipientEmail, code, amount: purchase.amount });
  return { reference: purchase.reference, amount: purchase.amount };
}

export async function redeemGiftCard(input: { code: string; cartTotal: number; ip: string; captchaToken?: string }) {
  const rate = checkGiftCardRedemptionRate(input.ip);
  if (!rate.allowed) throw new Error("Too many failed redemption attempts. Please try again later.");
  if (failedRedemptionCount(input.ip) >= 2 && !(await verifyCaptcha(input.captchaToken))) throw new Error("Complete CAPTCHA verification before trying another code.");
  const db = await requireDb();
  const [card] = await db.select().from(giftCards).where(and(eq(giftCards.codeHash, hashGiftCardCode(input.code)), eq(giftCards.status, "ACTIVE"))).limit(1);
  if (!card) { const attempts = recordFailedAttempt(input.ip); throw new Error(attempts >= 2 ? "Invalid code. CAPTCHA is now required." : "That gift-card code is invalid."); }
  if (!Number.isSafeInteger(input.cartTotal) || input.cartTotal <= 0) throw new Error("Enter a valid cart total.");
  const applied = Math.min(card.currentBalance, input.cartTotal);
  const remaining = card.currentBalance - applied;
  await db.update(giftCards).set({ currentBalance: remaining, status: remaining === 0 ? "EXHAUSTED" : "ACTIVE" }).where(and(eq(giftCards.id, card.id), gte(giftCards.currentBalance, applied)));
  return { appliedAmount: applied, remainingCartBalance: input.cartTotal - applied, remainingGiftCardBalance: remaining };
}
