import { describe, expect, it } from "vitest";
import { createFlutterwaveWebhookSignature, verifyFlutterwaveWebhookSignature } from "./flutterwave";

describe("Flutterwave webhook signature", () => {
  it("accepts only the expected HMAC-SHA256 base64 signature", () => {
    const rawBody = Buffer.from('{"type":"charge.completed","data":{"id":42}}');
    const signature = createFlutterwaveWebhookSignature(rawBody, "test-webhook-hash");
    expect(verifyFlutterwaveWebhookSignature(rawBody, signature, "test-webhook-hash")).toBe(true);
    expect(verifyFlutterwaveWebhookSignature(rawBody, "incorrect", "test-webhook-hash")).toBe(false);
  });
});
