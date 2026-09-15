import { createHmac, timingSafeEqual } from "node:crypto";

const FLUTTERWAVE_API_URL = "https://api.flutterwave.com/v3";

export class FlutterwaveProviderError extends Error {
  constructor(message: string, public readonly statusCode: number) {
    super(message);
    this.name = "FlutterwaveProviderError";
  }
}

export type VerifiedFlutterwaveTransaction = {
  id: string;
  reference: string;
  status: string;
  amountNaira: number;
  currency: string;
};

function getFlutterwaveSecret() {
  const secret = process.env.FLUTTERWAVE_SECRET_KEY;
  if (!secret) throw new FlutterwaveProviderError("Flutterwave is not configured on this server.", 503);
  return secret;
}

function getFlutterwaveWebhookHash() {
  const hash = process.env.FLUTTERWAVE_WEBHOOK_SECRET_HASH;
  if (!hash) throw new FlutterwaveProviderError("Flutterwave webhook verification is not configured on this server.", 503);
  return hash;
}

async function flutterwaveRequest<T>(path: string, init: RequestInit = {}) {
  const response = await fetch(`${FLUTTERWAVE_API_URL}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${getFlutterwaveSecret()}`, "Content-Type": "application/json", ...init.headers },
  });
  const payload = await response.json().catch(() => ({})) as { status?: unknown; message?: unknown; data?: T };
  if (!response.ok || payload.status !== "success") {
    throw new FlutterwaveProviderError(typeof payload.message === "string" ? payload.message : "Flutterwave could not process this request.", response.status);
  }
  return payload.data as T;
}

export async function resolveFlutterwaveNigerianAccount(input: { accountNumber: string; bankCode: string }) {
  if (!/^\d{10}$/.test(input.accountNumber)) throw new FlutterwaveProviderError("Enter a valid 10-digit Nigerian account number.", 400);
  if (!/^[A-Za-z0-9_-]{2,24}$/.test(input.bankCode)) throw new FlutterwaveProviderError("Select a valid Nigerian bank.", 400);
  const data = await flutterwaveRequest<{ account_number?: unknown; account_name?: unknown; bank_code?: unknown }>("/accounts/resolve", {
    method: "POST",
    body: JSON.stringify({ account_number: input.accountNumber, account_bank: input.bankCode }),
  });
  if (typeof data.account_number !== "string" || typeof data.account_name !== "string" || data.account_number !== input.accountNumber || !data.account_name.trim()) {
    throw new FlutterwaveProviderError("Flutterwave returned incomplete bank-account details.", 502);
  }
  return { accountNumber: data.account_number, accountName: data.account_name.trim(), bankCode: typeof data.bank_code === "string" ? data.bank_code : input.bankCode };
}

export async function initializeFlutterwavePayment(input: { email: string; reference: string; amountNaira: number; redirectUrl: string; title: string }) {
  if (!Number.isSafeInteger(input.amountNaira) || input.amountNaira < 100) throw new FlutterwaveProviderError("Enter a whole-Naira amount of at least ₦100.", 400);
  const data = await flutterwaveRequest<{ link?: unknown }>("/payments", {
    method: "POST",
    body: JSON.stringify({ tx_ref: input.reference, amount: input.amountNaira, currency: "NGN", redirect_url: input.redirectUrl, customer: { email: input.email }, customizations: { title: input.title }, meta: { alpha_reference: input.reference } }),
  });
  if (typeof data.link !== "string" || !data.link.startsWith("https://")) throw new FlutterwaveProviderError("Flutterwave did not return a valid payment link.", 502);
  return { authorizationUrl: data.link, reference: input.reference };
}

export async function verifyFlutterwaveTransaction(transactionId: string): Promise<VerifiedFlutterwaveTransaction> {
  const data = await flutterwaveRequest<{ id?: unknown; tx_ref?: unknown; status?: unknown; amount?: unknown; currency?: unknown }>(`/transactions/${encodeURIComponent(transactionId)}/verify`);
  if ((typeof data.id !== "number" && typeof data.id !== "string") || typeof data.tx_ref !== "string" || typeof data.status !== "string" || typeof data.amount !== "number" || !Number.isSafeInteger(data.amount) || typeof data.currency !== "string") {
    throw new FlutterwaveProviderError("Flutterwave returned incomplete transaction verification data.", 502);
  }
  return { id: String(data.id), reference: data.tx_ref, status: data.status, amountNaira: data.amount, currency: data.currency };
}

export function createFlutterwaveWebhookSignature(rawBody: Buffer | string, secretHash = getFlutterwaveWebhookHash()) {
  return createHmac("sha256", secretHash).update(rawBody).digest("base64");
}

export function verifyFlutterwaveWebhookSignature(rawBody: Buffer | string, signature: string | undefined, secretHash = getFlutterwaveWebhookHash()) {
  if (!signature) return false;
  const expected = Buffer.from(createFlutterwaveWebhookSignature(rawBody, secretHash));
  const received = Buffer.from(signature);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function isDefinitiveFlutterwaveRequestFailure(error: unknown) {
  return error instanceof FlutterwaveProviderError && error.statusCode >= 400 && error.statusCode < 500;
}
