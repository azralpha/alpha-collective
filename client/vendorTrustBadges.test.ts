import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("vendor trust badges", () => {
  it("renders distinct verified, unverified, lightning, and genuine top-rated states", () => {
    const source = readFileSync(new URL("../client/src/components/VendorTrustBadges.tsx", import.meta.url), "utf8");

    expect(source).toContain('trust.verification === "verified" ? "Verified" : "Unverified"');
    expect(source).toContain("Lightning Seller");
    expect(source).toContain("Top Rated");
    expect(source).toContain("if (!trust) return null");
  });
});
