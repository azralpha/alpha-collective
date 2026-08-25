import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyNowPaymentsIpn } from "./nowpayments";

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
