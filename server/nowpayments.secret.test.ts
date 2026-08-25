import { describe, expect, it } from "vitest";

describe.runIf(process.env.RUN_EXTERNAL_PROVIDER_CHECKS === "true")("NOWPayments server credential", () => {
  it("authenticates against the merchant payment-list endpoint without creating a payment", async () => {
    const apiKey = process.env.NOWPAYMENTS_API_KEY;
    expect(apiKey).toBeTruthy();
    const response = await fetch("https://api.nowpayments.io/v1/payment?limit=1", { headers: { "x-api-key": apiKey! } });
    expect(response.ok).toBe(true);
    const body = await response.json() as { data?: unknown[] };
    expect(Array.isArray(body.data)).toBe(true);
  }, 15_000);
});
