import { describe, expect, it } from "vitest";

describe("Paystack live credential", () => {
  it("authenticates a read-only bank-list request without exposing the key", async () => {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    expect(secret).toMatch(/^sk_live_/);

    const response = await fetch("https://api.paystack.co/bank?currency=NGN", {
      headers: { Authorization: `Bearer ${secret}` },
    });

    expect(response.ok).toBe(true);
    const payload = await response.json() as { status?: boolean };
    expect(payload.status).toBe(true);
  }, 10_000);
});
