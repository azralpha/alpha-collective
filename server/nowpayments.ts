import { createHmac, timingSafeEqual } from "node:crypto";

const PRODUCTION_NOWPAYMENTS_API_BASE = "https://api.nowpayments.io/v1";
export const MAX_LIVE_TEST_CRYPTO_FUNDING_NAIRA = 500;

export class NowPaymentsError extends Error {}

function requiredSecret(name: "NOWPAYMENTS_API_KEY" | "NOWPAYMENTS_IPN_SECRET") {
  const value = process.env[name];
  if (!value) throw new NowPaymentsError(`${name} is not configured.`);
  return value;
}

function apiBaseUrl() {
  const configured = process.env.NOWPAYMENTS_API_BASE_URL ?? PRODUCTION_NOWPAYMENTS_API_BASE;
  const url = new URL(configured);
  if (url.protocol !== "https:" || url.hostname !== "api.nowpayments.io" || url.pathname.replace(/\/$/, "") !== "/v1") {
    throw new NowPaymentsError("NOWPayments production API URL is not configured correctly.");
  }
  if (process.env.NOWPAYMENTS_TEST_MODE !== "false") throw new NowPaymentsError("NOWPayments production mode is not explicitly enabled.");
  return url.toString().replace(/\/$/, "");
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value as Record<string, unknown>).sort().map(key => [key, sortValue((value as Record<string, unknown>)[key])]));
  return value;
}

export function verifyNowPaymentsIpn(payload: Record<string, unknown>, signature: string | undefined) {
  if (!signature || !/^[a-f0-9]{128}$/i.test(signature)) return false;
  const canonicalPayload = JSON.stringify(sortValue(payload));
  const expected = createHmac("sha512", requiredSecret("NOWPAYMENTS_IPN_SECRET")).update(canonicalPayload).digest("hex");
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"));
}

type NowPaymentsPaymentResponse = {
  payment_id?: unknown;
  payment_status?: unknown;
  pay_address?: unknown;
  pay_amount?: unknown;
  pay_currency?: unknown;
  price_amount?: unknown;
  price_currency?: unknown;
  order_id?: unknown;
  expiration_estimate_date?: unknown;
};

export type VerifiedNowPaymentsPayment = {
  paymentId: string;
  status: string;
  payAddress: string;
  payAmount: string;
  payCurrency: string;
  priceAmount: number;
  priceCurrency: string;
  orderId: string;
  providerExpiry: Date | null;
};

function normalizePayment(body: NowPaymentsPaymentResponse): VerifiedNowPaymentsPayment {
  const paymentId = typeof body.payment_id === "string" || typeof body.payment_id === "number" ? String(body.payment_id) : "";
  const status = typeof body.payment_status === "string" ? body.payment_status.toLowerCase() : "";
  const payAddress = typeof body.pay_address === "string" ? body.pay_address.trim() : "";
  const payAmount = typeof body.pay_amount === "string" || typeof body.pay_amount === "number" ? String(body.pay_amount) : "";
  const payCurrency = typeof body.pay_currency === "string" ? body.pay_currency.toLowerCase() : "";
  const priceAmount = typeof body.price_amount === "string" || typeof body.price_amount === "number" ? Number(body.price_amount) : Number.NaN;
  const priceCurrency = typeof body.price_currency === "string" ? body.price_currency.toLowerCase() : "";
  const orderId = typeof body.order_id === "string" ? body.order_id : "";
  const providerExpiry = typeof body.expiration_estimate_date === "string" && !Number.isNaN(Date.parse(body.expiration_estimate_date)) ? new Date(body.expiration_estimate_date) : null;
  if (!paymentId || !status || !payAddress || !payAmount || !payCurrency || !Number.isFinite(priceAmount) || priceAmount <= 0 || !priceCurrency || !orderId) {
    throw new NowPaymentsError("NOWPayments returned an incomplete payment response.");
  }
  return { paymentId, status, payAddress, payAmount, payCurrency, priceAmount, priceCurrency, orderId, providerExpiry };
}

async function nowPaymentsRequest(path: string, init?: RequestInit) {
  const response = await fetch(`${apiBaseUrl()}${path}`, {
    ...init,
    headers: { "x-api-key": requiredSecret("NOWPAYMENTS_API_KEY"), ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new NowPaymentsError("NOWPayments could not complete the requested operation.");
  return response.json() as Promise<NowPaymentsPaymentResponse>;
}

export async function listNowPaymentsCurrencies() {
  const body = await nowPaymentsRequest("/currencies") as { currencies?: unknown };
  if (!Array.isArray(body.currencies)) throw new NowPaymentsError("NOWPayments returned an invalid currency list.");
  return body.currencies.filter((currency): currency is string => typeof currency === "string" && /^[a-z0-9_-]{2,24}$/i.test(currency)).map(currency => currency.toLowerCase());
}

export async function createControlledNowPaymentsQuote(input: { reference: string; amountNaira: number; payCurrency: string; ipnCallbackUrl: string }) {
  if (!Number.isSafeInteger(input.amountNaira) || input.amountNaira < 100 || input.amountNaira > MAX_LIVE_TEST_CRYPTO_FUNDING_NAIRA) {
    throw new NowPaymentsError(`Live crypto test quotes are limited to ₦${MAX_LIVE_TEST_CRYPTO_FUNDING_NAIRA.toLocaleString("en-NG")} or less.`);
  }
  if (!/^accrypto_[a-z0-9]{16,32}$/.test(input.reference)) throw new NowPaymentsError("The crypto funding reference is invalid.");
  if (!/^[a-z0-9_-]{2,24}$/i.test(input.payCurrency)) throw new NowPaymentsError("Choose a valid crypto asset.");
  const payment = normalizePayment(await nowPaymentsRequest("/payment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      price_amount: input.amountNaira,
      price_currency: "ngn",
      pay_currency: input.payCurrency.toLowerCase(),
      order_id: input.reference,
      order_description: "Alpha Market controlled crypto wallet test",
      ipn_callback_url: input.ipnCallbackUrl,
      is_fixed_rate: true,
    }),
  }));
  if (payment.orderId !== input.reference || payment.priceCurrency !== "ngn" || Math.round(payment.priceAmount) !== input.amountNaira || payment.payCurrency !== input.payCurrency.toLowerCase()) {
    throw new NowPaymentsError("NOWPayments quote did not match the protected wallet funding request.");
  }
  return payment;
}

export async function getVerifiedNowPaymentsPayment(paymentId: string) {
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(paymentId)) throw new NowPaymentsError("The NOWPayments payment ID is invalid.");
  return normalizePayment(await nowPaymentsRequest(`/payment/${encodeURIComponent(paymentId)}`));
}
