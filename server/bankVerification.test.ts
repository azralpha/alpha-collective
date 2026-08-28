import { describe, expect, it } from "vitest";
import { bankAccountNameMatchesProfile, maskAccountNumber, normalizePersonName } from "./bankVerification";

describe("Flutterwave bank verification safeguards", () => {
  it("normalizes punctuation, accents, and repeated whitespace", () => {
    expect(normalizePersonName("  Chiamaka  Nwosu-Oke  ")).toBe("chiamaka nwosu oke");
  });

  it("accepts a returned account name containing the profile first and last names", () => {
    expect(bankAccountNameMatchesProfile("Chiamaka Nwosu", "NWOSU OKE CHIAMAKA")).toBe(true);
  });

  it("rejects incomplete profile names and mismatches", () => {
    expect(bankAccountNameMatchesProfile("Chiamaka", "CHIAMAKA NWOSU")).toBe(false);
    expect(bankAccountNameMatchesProfile("Chiamaka Nwosu", "AMAKA OBI")).toBe(false);
  });

  it("masks all but the last four account digits", () => {
    expect(maskAccountNumber("0123456789")).toBe("••••••6789");
  });
});
