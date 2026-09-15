import { describe, expect, it } from "vitest";

describe.runIf(process.env.RUN_EXTERNAL_PROVIDER_CHECKS === "true")("Telegram server credential", () => {
  it("authenticates the configured bot token through Telegram getMe", async () => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    expect(token).toBeTruthy();
    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    expect(response.ok).toBe(true);
    const body = await response.json() as { ok?: boolean; result?: { is_bot?: boolean } };
    expect(body.ok).toBe(true);
    expect(body.result?.is_bot).toBe(true);
  }, 15_000);
});
