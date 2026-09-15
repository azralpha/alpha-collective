import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./src/components/BankVerificationWidget.tsx", import.meta.url), "utf8");

describe("Bank Verification Widget", () => {
  it("submits only a ten-digit account number to the protected Flutterwave route", () => {
    expect(source).toContain('fetch("/api/verify-bank-account"');
    expect(source).toContain('pattern="\\d{10}"');
    expect(source).toContain('slice(0, 10)');
  });

  it("makes the verification and privacy boundaries visible", () => {
    expect(source).toContain("Flutterwave will confirm the account name");
    expect(source).toContain("masked account number");
    expect(source).toContain("This payout account is locked");
  });
});
