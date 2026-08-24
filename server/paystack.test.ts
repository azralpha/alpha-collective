import { describe, expect, it } from "vitest";
import { PaystackProviderError, createPaystackWebhookSignature, isDefinitivePaystackRequestFailure, maskNigerianAccountNumber, toPaystackKobo, verifyPaystackWebhookSignature } from "./paystack";

describe("Paystack wallet safeguards", () => {
  it("converts whole Naira to Paystack kobo only at the provider boundary", () => {
    expect(toPaystackKobo(12_500)).toBe(1_250_000);
    expect(() => toPaystackKobo(0)).toThrow("positive whole-Naira");
    expect(() => toPaystackKobo(99.5)).toThrow("positive whole-Naira");
  });

  it("never returns a raw Nigerian account number from the masking helper", () => {
    expect(maskNigerianAccountNumber("0123456789")).toBe("••••••6789");
  });

  it("accepts only a matching SHA-512 signature for the original raw webhook body", () => {
    const secret = "test_wallet_secret";
    const rawBody = Buffer.from('{"event":"charge.success","data":{"reference":"acwfund_abc"}}');
    const signature = createPaystackWebhookSignature(rawBody, secret);
    expect(verifyPaystackWebhookSignature(rawBody, signature, secret)).toBe(true);
    expect(verifyPaystackWebhookSignature(Buffer.from('{"event":"charge.success"}'), signature, secret)).toBe(false);
    expect(verifyPaystackWebhookSignature(rawBody, undefined, secret)).toBe(false);
  });

  it("only treats clear client-side provider failures as safe to restore locally", () => {
    expect(isDefinitivePaystackRequestFailure(new PaystackProviderError("Invalid recipient", 400))).toBe(true);
    expect(isDefinitivePaystackRequestFailure(new PaystackProviderError("Provider unavailable", 503))).toBe(false);
  });
});
