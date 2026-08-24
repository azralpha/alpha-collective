import { describe, expect, it } from "vitest";
import { hashTransactionPin, validateTransactionPin, verifyTransactionPin } from "./walletSecurity";

describe("wallet transaction PIN security", () => {
  it("stores a salted hash and verifies only the matching four-digit PIN", async () => {
    const hash = await hashTransactionPin("4829");
    expect(hash).not.toContain("4829");
    await expect(verifyTransactionPin("4829", hash)).resolves.toBe(true);
    await expect(verifyTransactionPin("4828", hash)).resolves.toBe(false);
  });

  it("rejects PINs that are not exactly four digits", () => {
    expect(() => validateTransactionPin("123")).toThrow("exactly four digits");
    expect(() => validateTransactionPin("abcd")).toThrow("exactly four digits");
  });
});
