import { describe, expect, it } from "vitest";
import { hasSufficientWithdrawalBalance, quotePaystackWithdrawalFee } from "./paystackTransferFee";

describe("Paystack withdrawal fee quote", () => {
  it("uses the published NGN transfer tiers and adds the approved 20% platform markup", () => {
    expect(quotePaystackWithdrawalFee(5_000)).toEqual({ requestedAmount: 5_000, basePaystackFee: 10, processingFee: 12, totalDebited: 5_012 });
    expect(quotePaystackWithdrawalFee(5_001)).toEqual({ requestedAmount: 5_001, basePaystackFee: 25, processingFee: 30, totalDebited: 5_031 });
    expect(quotePaystackWithdrawalFee(50_001)).toEqual({ requestedAmount: 50_001, basePaystackFee: 50, processingFee: 60, totalDebited: 50_061 });
  });

  it("requires a balance that covers both the requested transfer and the fee", () => {
    const quote = quotePaystackWithdrawalFee(15_000);
    expect(hasSufficientWithdrawalBalance(15_029, quote)).toBe(false);
    expect(hasSufficientWithdrawalBalance(15_030, quote)).toBe(true);
  });
});
