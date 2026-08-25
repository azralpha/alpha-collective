import { describe, expect, it } from "vitest";
import { splitWalletPayment } from "./walletBalanceSplit";

describe("splitWalletPayment", () => {
  it("spends Shopping Bonus first and withdrawable funds only for the remainder", () => {
    expect(splitWalletPayment(7_500, 2_000)).toEqual({ bonusDebit: 2_000, withdrawableDebit: 5_500 });
    expect(splitWalletPayment(7_500, 9_000)).toEqual({ bonusDebit: 7_500, withdrawableDebit: 0 });
  });

  it("rejects fractional, negative, or zero monetary inputs", () => {
    expect(() => splitWalletPayment(0, 0)).toThrow();
    expect(() => splitWalletPayment(500.5, 0)).toThrow();
    expect(() => splitWalletPayment(500, -1)).toThrow();
  });
});
