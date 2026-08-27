import { describe, expect, it } from "vitest";

describe("Resend newsletter configuration", () => {
  it("accepts the configured server-only key for a read-only domain listing without sending email", async () => {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    expect(apiKey, "Configure RESEND_API_KEY before enabling newsletter delivery.").toBeTruthy();

    const response = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    expect(response.ok, `Resend read-only domain check returned HTTP ${response.status}.`).toBe(true);
  }, 20_000);
});
