import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  isTurnstileConfigured: vi.fn(),
  verifyTurnstileTokenForIp: vi.fn(),
}));

vi.mock("./db", () => ({ getDb: mocks.getDb }));
vi.mock("./turnstile", () => ({
  isTurnstileConfigured: mocks.isTurnstileConfigured,
  verifyTurnstileTokenForIp: mocks.verifyTurnstileTokenForIp,
}));

import { GIFT_CARD_TURNSTILE_ACTION } from "@shared/const";
import { hashGiftCardCode, redeemGiftCard } from "./giftCards";

function installDatabase(selectionResults: unknown[][]) {
  let selectionIndex = 0;
  const database = {
    select: vi.fn(() => {
      const result = selectionResults[selectionIndex++] ?? [];
      const query = {
        from: vi.fn(),
        where: vi.fn(),
        limit: vi.fn(),
      };
      query.from.mockReturnValue(query);
      query.where.mockReturnValue(query);
      query.limit.mockResolvedValue(result);
      return query;
    }),
    update: vi.fn(() => ({
      set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
    })),
  };

  mocks.getDb.mockResolvedValue(database);
  return database;
}

const invalidCode = "ALPHA-0000-0000-0000";

async function tryInvalidCode(ip: string, turnstileToken?: string) {
  return redeemGiftCard({ code: invalidCode, cartTotal: 1_000, ip, turnstileToken });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isTurnstileConfigured.mockReturnValue(true);
  mocks.verifyTurnstileTokenForIp.mockResolvedValue(false);
});

describe("gift-card redemption Turnstile", () => {
  it("requires server verification only after two failed code attempts", async () => {
    const ip = "198.51.100.41";
    const database = installDatabase([[], []]);

    await expect(tryInvalidCode(ip)).rejects.toThrow("That gift-card code is invalid.");
    await expect(tryInvalidCode(ip)).rejects.toThrow("Invalid code. CAPTCHA is now required.");
    expect(mocks.verifyTurnstileTokenForIp).not.toHaveBeenCalled();

    await expect(tryInvalidCode(ip)).rejects.toThrow("Complete CAPTCHA verification before trying another code.");
    expect(mocks.verifyTurnstileTokenForIp).toHaveBeenCalledWith(ip, undefined, GIFT_CARD_TURNSTILE_ACTION);
    expect(database.select).toHaveBeenCalledTimes(2);
  });

  it("fails closed when the server Turnstile configuration is missing", async () => {
    const ip = "198.51.100.42";
    installDatabase([[], []]);

    await expect(tryInvalidCode(ip)).rejects.toThrow("That gift-card code is invalid.");
    await expect(tryInvalidCode(ip)).rejects.toThrow("Invalid code. CAPTCHA is now required.");
    mocks.isTurnstileConfigured.mockReturnValue(false);

    await expect(tryInvalidCode(ip, "challenge-token")).rejects.toThrow("Security verification is temporarily unavailable.");
    expect(mocks.verifyTurnstileTokenForIp).not.toHaveBeenCalled();
  });

  it("passes the gift-card action and IP to Siteverify, and proceeds only on success", async () => {
    const ip = "198.51.100.43";
    const code = "ALPHA-1234-5678-90AB";
    const card = { id: 9, codeHash: hashGiftCardCode(code), currentBalance: 1_500, status: "ACTIVE" };
    const database = installDatabase([[], [], [card]]);
    mocks.verifyTurnstileTokenForIp.mockResolvedValue(true);

    await expect(tryInvalidCode(ip)).rejects.toThrow("That gift-card code is invalid.");
    await expect(tryInvalidCode(ip)).rejects.toThrow("Invalid code. CAPTCHA is now required.");

    await expect(redeemGiftCard({ code, cartTotal: 700, ip, turnstileToken: "challenge-token" })).resolves.toEqual({
      appliedAmount: 700,
      remainingCartBalance: 0,
      remainingGiftCardBalance: 800,
    });
    expect(mocks.verifyTurnstileTokenForIp).toHaveBeenCalledWith(ip, "challenge-token", GIFT_CARD_TURNSTILE_ACTION);
    expect(database.update).toHaveBeenCalledTimes(1);
  });
});
