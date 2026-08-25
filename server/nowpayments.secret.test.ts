import { describe, expect, it } from "vitest";

describe.runIf(process.env.RUN_EXTERNAL_PROVIDER_CHECKS === "true")("NOWPayments server credential", () => {
  it("authenticates against the documented currencies endpoint without creating a payment", async () => {
    const apiKey = process.env.NOWPAYMENTS_API_KEY;
    expect(apiKey).toBeTruthy();
    const response = await fetch("https://api.nowpayments.io/v1/currencies", { headers: { "x-api-key": apiKey! } });
    expect(response.ok).toBe(true);
    const body = await response.json() as { currencies?: unknown[] };
    expect(Array.isArray(body.currencies)).toBe(true);
  }, 15_000);
});
