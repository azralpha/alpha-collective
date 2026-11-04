import { afterEach, describe, expect, it, vi } from "vitest";
import { createFlutterwaveWebhookSignature, initializeFlutterwavePayment, verifyFlutterwaveWebhookSignature } from "./flutterwave";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Flutterwave webhook signature", () => {
  it("accepts only the expected HMAC-SHA256 base64 signature", () => {
    const rawBody = Buffer.from('{"type":"charge.completed","data":{"id":42}}');
    const signature = createFlutterwaveWebhookSignature(rawBody, "test-webhook-hash");
    expect(verifyFlutterwaveWebhookSignature(rawBody, signature, "test-webhook-hash")).toBe(true);
    expect(verifyFlutterwaveWebhookSignature(rawBody, "incorrect", "test-webhook-hash")).toBe(false);
  });

  it("sends the Alpha Market metadata to Flutterwave when initializing a payment", async () => {
    vi.stubEnv("FLUTTERWAVE_SECRET_KEY", "test-secret");
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "success", data: { link: "https://checkout.flutterwave.com/test" } }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await initializeFlutterwavePayment({
      email: "buyer@example.com",
      reference: "acfwfund_test",
      amountNaira: 12_500,
      redirectUrl: "https://alphamarket.name.ng/payment/complete",
      title: "Alpha Wallet funding",
      metadata: { platform: "alpha_market", order_id: null, user_id: 42, vendor_id: null, source: "alphamarket.name.ng" },
    });

    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(requestBody.meta).toMatchObject({ platform: "alpha_market", order_id: null, user_id: 42, vendor_id: null, source: "alphamarket.name.ng" });
  });
});
