import { describe, expect, it } from "vitest";
import { calculateCartTierProgress, isWithinTierUpsellRange, rewardLabel, type CartRewardTier } from "./cartTierRewards";

const tiers: CartRewardTier[] = [
  { id: 1, name: "Silver Supporter", minimumSpend: 15_000, rewardType: "alpha_wallet_credit", rewardValue: 1_000, giftOfficialProductId: null, profitSafeguardMargin: 25, active: true },
  { id: 2, name: "Gold VIP", minimumSpend: 25_000, rewardType: "free_shipping", rewardValue: 0, giftOfficialProductId: null, profitSafeguardMargin: 25, active: true },
];

describe("tiered cart reward policy", () => {
  it("shows the next tier and enables smart upsell only within the final quarter of its target", () => {
    const progress = calculateCartTierProgress({ subtotal: 12_000, tiers, profitFacts: [{ productId: "vendor-1", revenue: 12_000, platformProfit: 3_600 }] });
    expect(progress.nextTier?.name).toBe("Silver Supporter");
    expect(progress.amountRemaining).toBe(3_000);
    expect(isWithinTierUpsellRange(progress)).toBe(true);
  });

  it("unlocks only the highest reached tier whose verified profit margin satisfies its safeguard", () => {
    const progress = calculateCartTierProgress({ subtotal: 16_000, tiers, profitFacts: [{ productId: "official-1", revenue: 16_000, platformProfit: 4_800 }] });
    expect(progress.unlockedTier?.name).toBe("Silver Supporter");
    expect(progress.profitMarginPercent).toBe(30);
    expect(rewardLabel(progress.unlockedTier!)).toBe("₦1,000 Shopping Bonus");
  });

  it("fails closed when any cart line lacks a verified profit basis", () => {
    const progress = calculateCartTierProgress({ subtotal: 16_000, tiers, profitFacts: [{ productId: "official-1", revenue: 16_000, platformProfit: null }] });
    expect(progress.unlockedTier).toBeNull();
    expect(progress.hasUnknownProfit).toBe(true);
  });
});
