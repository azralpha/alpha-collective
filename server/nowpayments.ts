import { createHmac, timingSafeEqual } from "node:crypto";

const NOWPAYMENTS_API_BASE = "https://api.nowpayments.io/v1";

export class NowPaymentsError extends Error {}

function requiredSecret(name: "NOWPAYMENTS_API_KEY" | "NOWPAYMENTS_IPN_SECRET") {
  const value = process.env[name];
  if (!value) throw new NowPaymentsError(`${name} is not configured.`);
  return value;
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

export async function listNowPaymentsCurrencies() {
  const response = await fetch(`${NOWPAYMENTS_API_BASE}/currencies`, { headers: { "x-api-key": requiredSecret("NOWPAYMENTS_API_KEY") }, signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new NowPaymentsError("NOWPayments currency discovery failed.");
  const body = await response.json() as { currencies?: unknown };
  if (!Array.isArray(body.currencies)) throw new NowPaymentsError("NOWPayments returned an invalid currency list.");
  return body.currencies.filter((currency): currency is string => typeof currency === "string" && /^[a-z0-9_-]{2,24}$/i.test(currency)).map(currency => currency.toLowerCase());
}
