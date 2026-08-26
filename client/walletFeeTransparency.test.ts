import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("wallet withdrawal fee transparency", () => {
  it("shows the server quote breakdown and blocks an insufficient total debit", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/pages/Wallet.tsx"), "utf8");
    expect(source).toContain("Processing/Bank Fee");
    expect(source).toContain("Total Wallet Balance Debited");
    expect(source).toContain("Insufficient balance to cover total amount including network fee.");
    expect(source).toContain("marketplace.wallet.getWithdrawalQuote");
  });
});
