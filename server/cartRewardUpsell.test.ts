import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCartTierProgress: vi.fn(),
  listPublishedTierUpsellCandidates: vi.fn(),
}));

vi.mock("./db", () => mocks);

import { getCartRewardUpsells } from "./cartRewardUpsell";

describe("cart reward smart upsells", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubEnv("GEMINI_API_KEY", "");
    mocks.getCartTierProgress.mockReset();
    mocks.listPublishedTierUpsellCandidates.mockReset();
  });

  it("returns no recommendations until the shopper is within the final quarter of the next active target", async () => {
    mocks.getCartTierProgress.mockResolvedValue({ subtotal: 8_000, amountRemaining: 7_000, nextTier: { name: "Silver", minimumSpend: 15_000 }, progressPercent: 53, unlockedTier: null, profitAmount: 0, profitMarginPercent: 0, profitSafeguardPassed: false, hasUnknownProfit: false });
    await expect(getCartRewardUpsells({ items: [{ productId: "official-1", quantity: 1 }] })).resolves.toMatchObject({ eligible: false, recommendations: [] });
    expect(mocks.listPublishedTierUpsellCandidates).not.toHaveBeenCalled();
  });

  it("uses only published database candidates and preserves cart-item exclusion when the tier is close", async () => {
    mocks.getCartTierProgress.mockResolvedValue({ subtotal: 12_000, amountRemaining: 3_000, nextTier: { name: "Silver", minimumSpend: 15_000 }, progressPercent: 80, unlockedTier: null, profitAmount: 0, profitMarginPercent: 0, profitSafeguardPassed: false, hasUnknownProfit: false });
    mocks.listPublishedTierUpsellCandidates.mockResolvedValue([
      { id: "official-2", title: "Verified item", price: 2_900, imageUrl: "/verified.webp", category: "Gadgets" },
      { id: "vendor-4", title: "Local item", price: 3_100, imageUrl: "/local.webp", category: "Fashion" },
    ]);
    const result = await getCartRewardUpsells({ items: [{ productId: "official-1", quantity: 1 }] });
    expect(mocks.listPublishedTierUpsellCandidates).toHaveBeenCalledWith({ amountRemaining: 3_000, excludeProductIds: ["official-1"] });
    expect(result).toMatchObject({ eligible: true, recommendations: [{ productId: "official-2", price: 2_900 }, { productId: "vendor-4", price: 3_100 }] });
  });
});
