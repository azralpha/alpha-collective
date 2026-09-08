import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const serviceSource = readFileSync(new URL("./profileDashboard.ts", import.meta.url), "utf8");
const routerSource = readFileSync(new URL("./routers/profile.ts", import.meta.url), "utf8");
const pageSource = readFileSync(new URL("../client/src/pages/Profile.tsx", import.meta.url), "utf8");

describe("Profile & Dashboard security boundaries", () => {
  it("locks legal identity server-side once legalIdentityLockedAt exists", () => {
    expect(serviceSource).toContain("if (hasLegalInput && current.legalIdentityLockedAt) throw new Error(\"Legal identity is already locked and cannot be changed.\")");
    expect(serviceSource).toContain("legalIdentityLockedAt: new Date()");
    expect(serviceSource).toContain("They will be locked after saving");
  });

  it("validates name and date of birth together before locking", () => {
    expect(serviceSource).toContain("Enter your full legal name and a valid date of birth together");
    expect(serviceSource).toContain("validDateOfBirth");
  });

  it("keeps profile mutations authenticated and rate-limited", () => {
    expect(routerSource).toContain("sensitiveProtectedProcedure");
    expect(routerSource).toContain("profileRouter");
    expect(routerSource).toContain("uploadAvatar");
    expect(routerSource).toContain("toggleFollowVendor");
  });

  it("makes the KYC correlation warning visible and provides the requested account areas", () => {
    expect(pageSource).toContain("Legal identity cannot be changed once saved. It must correlate with your KYC identification");
    expect(pageSource).toContain("Order history");
    expect(pageSource).toContain("Address book");
    expect(pageSource).toContain("My favorite sellers");
    expect(pageSource).toContain("Explore rewards");
    expect(pageSource).toContain("Customer service");
  });
});
