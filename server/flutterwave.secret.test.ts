import { describe, expect, it } from "vitest";

describe("Flutterwave live credential", () => {
  it("authenticates a read-only Nigerian bank-list request without exposing the key", async () => {
    const secret = process.env.FLUTTERWAVE_SECRET_KEY;
    expect(secret).toMatch(/^FLWSECK(?:_LIVE)?[-_]/);

    const response = await fetch("https://api.flutterwave.com/v3/banks/NG", {
      headers: { Authorization: `Bearer ${secret}` },
    });

    const body = await response.text();
    expect(response.ok).toBe(true);
    const payload = JSON.parse(body) as { status?: string };
    expect(payload.status).toBe("success");
  }, 10_000);
});
