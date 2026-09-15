import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("wallet fiat gateway options", () => {
  it("keeps Paystack and Flutterwave selectable for KYC-protected wallet funding", () => {
    const source = readFileSync(new URL("../client/src/pages/Wallet.tsx", import.meta.url), "utf8");
    expect(source).toContain('value="paystack"');
    expect(source).toContain('value="flutterwave"');
    expect(source).toContain("provider: fundingProvider");
  });
});
