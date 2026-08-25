import { describe, expect, it } from "vitest";
import { displayWalletAmount } from "./src/lib/walletPrivacy";

describe("wallet balance privacy display", () => {
  it("masks the underlying Naira amount without changing the balance value", () => {
    expect(displayWalletAmount(12_500, true)).toBe("••••••");
    expect(displayWalletAmount(12_500, false)).toContain("12,500");
  });
});
