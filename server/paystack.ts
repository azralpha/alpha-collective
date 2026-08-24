import { createHmac, timingSafeEqual } from "node:crypto";

const PAYSTACK_API_URL = "https://api.paystack.co";
const BANK_CACHE_TTL_MS = 60 * 60 * 1000;

type PaystackEnvelope<T> = {
  status: boolean;
  message: string;
  data: T;
};

export type PaystackBank = {
  name: string;
  code: string;
};

export type ResolvedPaystackAccount = {
  accountName: string;
  accountNumber: string;
};

export type VerifiedPaystackTransaction = {
  id: string;
  reference: string;
  status: string;
  amountKobo: number;
};

export class PaystackProviderError extends Error {
  constructor(message: string, public readonly statusCode: number) {
    super(message);
    this.name = "PaystackProviderError";
  }
}

let bankCache: { expiresAt: number; banks: PaystackBank[] } | null = null;

function getPaystackSecret() {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) throw new PaystackProviderError("Paystack is not configured on this server.", 503);
  return secret;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

async function paystackRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${PAYSTACK_API_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getPaystackSecret()}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  const payload = await response.json().catch(() => ({})) as Partial<PaystackEnvelope<T>>;
  if (!response.ok || !payload.status) {
    throw new PaystackProviderError(typeof payload.message === "string" ? payload.message : "Paystack could not process this request.", response.status);
  }
  return payload.data as T;
}

export function toPaystackKobo(amountNaira: number) {
  if (!Number.isSafeInteger(amountNaira) || amountNaira < 1) throw new Error("A positive whole-Naira amount is required.");
  return amountNaira * 100;
}

export function maskNigerianAccountNumber(accountNumber: string) {
  return `${"•".repeat(Math.max(0, accountNumber.length - 4))}${accountNumber.slice(-4)}`;
}

export async function listPaystackNigerianBanks() {
  if (bankCache && bankCache.expiresAt > Date.now()) return bankCache.banks;
  const banks = await paystackRequest<Array<{ name?: unknown; code?: unknown; active?: unknown }>>("/bank?currency=NGN&perPage=100");
  const normalized = banks
    .filter(bank => bank.active !== false && typeof bank.name === "string" && typeof bank.code === "string")
    .map(bank => ({ name: bank.name as string, code: bank.code as string }))
    .sort((left, right) => left.name.localeCompare(right.name));
  bankCache = { banks: normalized, expiresAt: Date.now() + BANK_CACHE_TTL_MS };
  return normalized;
}

export async function resolvePaystackNigerianAccount(accountNumber: string, bankCode: string): Promise<ResolvedPaystackAccount> {
  const data = await paystackRequest<{ account_name?: unknown; account_number?: unknown }>(`/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`);
  if (typeof data.account_name !== "string" || typeof data.account_number !== "string") {
    throw new PaystackProviderError("Paystack did not return a verified account name.", 502);
  }
  return { accountName: data.account_name, accountNumber: data.account_number };
}

export async function createPaystackTransferRecipient(input: { accountName: string; accountNumber: string; bankCode: string }) {
  const data = await paystackRequest<{ recipient_code?: unknown }>("/transferrecipient", {
    method: "POST",
    body: JSON.stringify({
      type: "nuban",
      name: input.accountName,
      account_number: input.accountNumber,
      bank_code: input.bankCode,
      currency: "NGN",
    }),
  });
  if (typeof data.recipient_code !== "string" || !data.recipient_code) {
    throw new PaystackProviderError("Paystack did not return a payout recipient code.", 502);
  }
  return data.recipient_code;
}

export async function initializePaystackFunding(input: { email: string; reference: string; amountNaira: number; callbackUrl?: string }) {
  const data = await paystackRequest<{ authorization_url?: unknown; reference?: unknown }>("/transaction/initialize", {
    method: "POST",
    body: JSON.stringify({
      email: input.email,
      amount: toPaystackKobo(input.amountNaira),
      reference: input.reference,
      callback_url: input.callbackUrl,
      metadata: { wallet_reference: input.reference },
    }),
  });
  if (typeof data.authorization_url !== "string" || typeof data.reference !== "string" || data.reference !== input.reference) {
    throw new PaystackProviderError("Paystack did not return a valid funding authorization URL.", 502);
  }
  return { authorizationUrl: data.authorization_url, reference: data.reference };
}

export async function verifyPaystackTransaction(reference: string): Promise<VerifiedPaystackTransaction> {
  const data = await paystackRequest<{ id?: unknown; reference?: unknown; status?: unknown; amount?: unknown }>(`/transaction/verify/${encodeURIComponent(reference)}`);
  if (typeof data.id !== "number" && typeof data.id !== "string") throw new PaystackProviderError("Paystack did not return a transaction identifier.", 502);
  if (typeof data.reference !== "string" || typeof data.status !== "string" || !Number.isSafeInteger(data.amount)) {
    throw new PaystackProviderError("Paystack returned incomplete transaction verification data.", 502);
  }
  return { id: String(data.id), reference: data.reference, status: data.status, amountKobo: data.amount as number };
}

export async function initiatePaystackTransfer(input: { recipientCode: string; reference: string; amountNaira: number }) {
  const data = await paystackRequest<{ transfer_code?: unknown }>("/transfer", {
    method: "POST",
    body: JSON.stringify({
      source: "balance",
      amount: toPaystackKobo(input.amountNaira),
      recipient: input.recipientCode,
      reference: input.reference,
      reason: "Alpha Collective Wallet withdrawal",
    }),
  });
  if (typeof data.transfer_code !== "string" || !data.transfer_code) {
    throw new PaystackProviderError("Paystack did not return a transfer code.", 502);
  }
  return { transferCode: data.transfer_code };
}

export function createPaystackWebhookSignature(rawBody: Buffer | string, secret: string) {
  return createHmac("sha512", secret).update(rawBody).digest("hex");
}

export function verifyPaystackWebhookSignature(rawBody: Buffer | string, signature: string | undefined, secret = getPaystackSecret()) {
  if (!signature || !/^[a-f0-9]{128}$/i.test(signature)) return false;
  const expected = Buffer.from(createPaystackWebhookSignature(rawBody, secret), "hex");
  const received = Buffer.from(signature, "hex");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function isDefinitivePaystackRequestFailure(error: unknown) {
  return error instanceof PaystackProviderError && error.statusCode >= 400 && error.statusCode < 500;
}
