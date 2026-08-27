import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Spin to Win promotion interface", () => {
  it("uses a timed and exit-intent trigger, explicit close control, server claim endpoint, and a global live countdown banner", () => {
    const modal = readFileSync(resolve(process.cwd(), "client/src/components/SpinToWinPromotion.tsx"), "utf8");
    const banner = readFileSync(resolve(process.cwd(), "client/src/components/SpinClaimBanner.tsx"), "utf8");
    const shell = readFileSync(resolve(process.cwd(), "client/src/components/MarketplaceShell.tsx"), "utf8");
    expect(modal).toContain("5_000");
    expect(modal).toContain('document.addEventListener("mouseleave"');
    expect(modal).toContain("Close Spin to Win promotion");
    expect(modal).toContain('fetch("/api/rewards/spin-claim"');
    expect(modal).toContain("not a game of chance");
    expect(banner).toContain("getCartSubtotal");
    expect(banner).toContain("remaining");
    expect(shell).toContain("SpinClaimBanner");
    expect(shell).toContain("SpinToWinPromotion");
  });

  it("keeps promotion policy controls in the administrator reward page", () => {
    const admin = readFileSync(resolve(process.cwd(), "client/src/pages/AdminTieredCartRewards.tsx"), "utf8");
    expect(admin).toContain("spinPromotionSettings");
    expect(admin).toContain("saveSpinPromotionSettings");
    expect(admin).toContain("Minimum protected margin");
    expect(admin).toContain("Prize countdown");
  });
});
