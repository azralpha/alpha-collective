import { describe, expect, it } from "vitest";
import {
  REFERRAL_DISCOUNT,
  LAUNCH_PROMO_COMMISSION_RATE,
  calculateVendorCommission,
  createOrderReference,
  formatNaira,
  getCartSubtotal,
  getCheckoutTotals,
  qualifiesForReferralDiscount,
  resolveCartLines,
} from "./marketplace";

describe("marketplace money and cart rules", () => {
  it("formats Nigerian Naira values without decimal fragments", () => {
    expect(formatNaira(18500)).toBe("₦18,500");
  });

  it("resolves valid products and calculates quantities and subtotal", () => {
    const items = [
      { productId: "soft-structure-tote", quantity: 2 },
      { productId: "pulse-buds-mini", quantity: 1 },
      { productId: "unknown", quantity: 4 },
    ];
    expect(resolveCartLines(items)).toHaveLength(2);
    expect(getCartSubtotal(items)).toBe(58900);
  });

  it("applies the ₦500 referral discount only at the published threshold", () => {
    expect(qualifiesForReferralDiscount(4999)).toBe(false);
    expect(qualifiesForReferralDiscount(5000)).toBe(true);
    const totals = getCheckoutTotals([{ productId: "clay-table-bowl", quantity: 1 }], true);
    expect(totals.discount).toBe(REFERRAL_DISCOUNT);
    expect(totals.total).toBe(10800);
  });

  it("clamps seller commission guidance to the advertised 10–15% range", () => {
    expect(calculateVendorCommission(10000, 8)).toBe(1000);
    expect(calculateVendorCommission(10000, 12)).toBe(1200);
    expect(calculateVendorCommission(10000, 20)).toBe(1500);
  });

  it("applies the 0% launch commission promotion without changing later guidance", () => {
    expect(calculateVendorCommission(4500, LAUNCH_PROMO_COMMISSION_RATE)).toBe(0);
  });

  it("generates readable Alpha Collective order references", () => {
    expect(createOrderReference()).toMatch(/^AC-[A-Z0-9]{5}-[A-Z0-9]{5}$/);
  });
});
