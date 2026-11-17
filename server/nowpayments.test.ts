import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createControlledNowPaymentsQuote, MAX_CRYPTO_CHECKOUT_NAIRA, MAX_CRYPTO_FUNDING_NAIRA, verifyNowPaymentsIpn } from "./nowpayments";
import { verifiedNowPaymentsPaymentMatchesAttempt } from "./nowpaymentsWebhook";

describe("NOWPayments IPN verification", () => {
  it("accepts only the expected sha512 HMAC over recursively sorted payload keys", () => {
    const secret = process.env.NOWPAYMENTS_IPN_SECRET;
    expect(secret).toBeTruthy();
    const payload = { payment_status: "finished", amount: 15, nested: { z: 1, a: "value" } };
    const canonical = JSON.stringify({ amount: 15, nested: { a: "value", z: 1 }, payment_status: "finished" });
    const signature = createHmac("sha512", secret!).update(canonical).digest("hex");
    expect(verifyNowPaymentsIpn(payload, signature)).toBe(true);
    expect(verifyNowPaymentsIpn(payload, "0".repeat(128))).toBe(false);
  });
});

describe("NOWPayments production quotes", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("rejects an amount above the production funding limit before any provider request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(createControlledNowPaymentsQuote({ reference: "accrypto_abcdefghijklmnopqrst", amountNaira: MAX_CRYPTO_FUNDING_NAIRA + 1, payCurrency: "usdttrc20", ipnCallbackUrl: "https://alphashop-3pdenj2y.manus.space/api/webhooks/nowpayments" })).rejects.toThrow("limited");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("enforces the production checkout limit before any provider request", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(createControlledNowPaymentsQuote({ reference: "accrypto_abcdefghijklmnopqrst", amountNaira: MAX_CRYPTO_CHECKOUT_NAIRA + 1, payCurrency: "usdttrc20", ipnCallbackUrl: "https://alphashop-3pdenj2y.manus.space/api/webhooks/nowpayments", maximumAmountNaira: MAX_CRYPTO_CHECKOUT_NAIRA })).rejects.toThrow("5,000,000");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects Bitcoin and permits the two supported USDT network tickers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ payment_id: "payment_trx", payment_status: "waiting", pay_address: "TWalletAddress", pay_amount: "0.2", pay_currency: "usdttrx", price_amount: 500, price_currency: "ngn", order_id: "accrypto_abcdefghijklmnopqrst" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(createControlledNowPaymentsQuote({ reference: "accrypto_abcdefghijklmnopqrst", amountNaira: 500, payCurrency: "btc", ipnCallbackUrl: "https://alphashop-3pdenj2y.manus.space/api/webhooks/nowpayments" })).rejects.toThrow("Only USDT");
    expect(fetchMock).not.toHaveBeenCalled();
    await expect(createControlledNowPaymentsQuote({ reference: "accrypto_abcdefghijklmnopqrst", amountNaira: 500, payCurrency: "usdttrx", ipnCallbackUrl: "https://alphashop-3pdenj2y.manus.space/api/webhooks/nowpayments" })).resolves.toMatchObject({ payCurrency: "usdttrx" });
  });

  it("creates only an exact Naira-bound quote with the server callback URL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ payment_id: "payment_1", payment_status: "waiting", pay_address: "TWalletAddress", pay_amount: "0.2", pay_currency: "usdttrc20", price_amount: 500, price_currency: "ngn", order_id: "accrypto_abcdefghijklmnopqrst" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const quote = await createControlledNowPaymentsQuote({ reference: "accrypto_abcdefghijklmnopqrst", amountNaira: 500, payCurrency: "usdttrc20", ipnCallbackUrl: "https://alphashop-3pdenj2y.manus.space/api/webhooks/nowpayments" });
    expect(quote.paymentId).toBe("payment_1");
    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body))).toMatchObject({ price_amount: 500, price_currency: "ngn", pay_currency: "usdttrc20", order_id: "accrypto_abcdefghijklmnopqrst", ipn_callback_url: "https://alphashop-3pdenj2y.manus.space/api/webhooks/nowpayments" });
  });
});

describe("NOWPayments independent callback match", () => {
  const attempt = { reference: "accrypto_abcdefghijklmnopqrst", amountNaira: 500, payCurrency: "usdttrc20" };

  it("accepts only an exact independently verified provider payment match", () => {
    expect(verifiedNowPaymentsPaymentMatchesAttempt({ attempt, payment: { orderId: attempt.reference, priceCurrency: "ngn", priceAmount: 500, payCurrency: "usdttrc20" } })).toBe(true);
    expect(verifiedNowPaymentsPaymentMatchesAttempt({ attempt, payment: { orderId: attempt.reference, priceCurrency: "ngn", priceAmount: 499, payCurrency: "usdttrc20" } })).toBe(false);
    expect(verifiedNowPaymentsPaymentMatchesAttempt({ attempt, payment: { orderId: "other", priceCurrency: "ngn", priceAmount: 500, payCurrency: "usdttrc20" } })).toBe(false);
    expect(verifiedNowPaymentsPaymentMatchesAttempt({ attempt, payment: { orderId: attempt.reference, priceCurrency: "ngn", priceAmount: 500, payCurrency: "btc" } })).toBe(false);
    expect(verifiedNowPaymentsPaymentMatchesAttempt({ attempt: { ...attempt, payCurrency: "btc" }, payment: { orderId: attempt.reference, priceCurrency: "ngn", priceAmount: 500, payCurrency: "btc" } })).toBe(false);
  });
});
