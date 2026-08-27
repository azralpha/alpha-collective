import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createSpinRewardClaim: vi.fn(),
  getActiveSpinRewardClaimByVisitorHash: vi.fn(),
  getSpinPromotionSettings: vi.fn(),
  listSpinEligibleGiftCandidates: vi.fn(),
}));

vi.mock("./db", () => mocks);

import { claimSpinReward, hashSpinClaimToken } from "./spinPromotion";

const candidate = { id: 9, title: "Smart Ring", price: 8_000, imageUrl: "/ring.webp", rewardCost: 700, grossMargin: 0.46 };

describe("transparent Spin to Win promotion", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubEnv("GEMINI_API_KEY", "");
    mocks.createSpinRewardClaim.mockReset();
    mocks.getActiveSpinRewardClaimByVisitorHash.mockReset();
    mocks.getSpinPromotionSettings.mockReset();
    mocks.listSpinEligibleGiftCandidates.mockReset();
  });

  it("does not offer a prize while the administrator policy is disabled", async () => {
    mocks.getSpinPromotionSettings.mockResolvedValue({ enabled: false, profitSafeguardMargin: 25, countdownMinutes: 20 });
    await expect(claimSpinReward({ visitorId: "visitor-1234567890-safe" })).resolves.toEqual({ enabled: false, claimed: false, reason: "disabled" });
    expect(mocks.listSpinEligibleGiftCandidates).not.toHaveBeenCalled();
  });

  it("creates an opaque, expiring claim from server-supplied profit-qualified gifts without exposing their cost", async () => {
    mocks.getSpinPromotionSettings.mockResolvedValue({ enabled: true, profitSafeguardMargin: 25, countdownMinutes: 20 });
    mocks.getActiveSpinRewardClaimByVisitorHash.mockResolvedValue(null);
    mocks.listSpinEligibleGiftCandidates.mockResolvedValue([candidate]);
    mocks.createSpinRewardClaim.mockImplementation(async input => ({ ...input, id: 3, userId: null, orderReference: null, status: "claimed", settledAt: null, createdAt: new Date(), updatedAt: new Date() }));

    const result = await claimSpinReward({ visitorId: "visitor-1234567890-safe" });

    expect(mocks.listSpinEligibleGiftCandidates).toHaveBeenCalledWith(25);
    expect(mocks.createSpinRewardClaim).toHaveBeenCalledWith(expect.objectContaining({ rewardOfficialProductId: 9, rewardCost: 700, profitSafeguardMargin: 25, minimumSpend: expect.any(Number), tokenHash: expect.stringMatching(/^[a-f0-9]{64}$/) }));
    expect(result).toMatchObject({ enabled: true, claimed: true, rewardName: "Free Smart Ring unlocked", rewardItemId: "official-9", minimumSpend: expect.any(Number) });
    expect(result).not.toHaveProperty("rewardCost");
    expect(result.claimToken).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(hashSpinClaimToken(result.claimToken!)).toBe((mocks.createSpinRewardClaim.mock.calls[0][0] as { tokenHash: string }).tokenHash);
  });

  it("reuses an active visitor claim without issuing a second token or calling Gemini candidates", async () => {
    mocks.getSpinPromotionSettings.mockResolvedValue({ enabled: true, profitSafeguardMargin: 25, countdownMinutes: 20 });
    mocks.getActiveSpinRewardClaimByVisitorHash.mockResolvedValue({ rewardName: "Free Smart Ring unlocked", rewardOfficialProductId: 9, minimumSpend: 12_000, expiresAt: new Date(Date.now() + 60_000) });
    await expect(claimSpinReward({ visitorId: "visitor-1234567890-safe" })).resolves.toMatchObject({ enabled: true, claimed: true, reused: true, rewardItemId: "official-9" });
    expect(mocks.listSpinEligibleGiftCandidates).not.toHaveBeenCalled();
    expect(mocks.createSpinRewardClaim).not.toHaveBeenCalled();
  });
});
