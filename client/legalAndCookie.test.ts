import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync(new URL("./src/App.tsx", import.meta.url), "utf8");
const shellSource = readFileSync(new URL("./src/components/MarketplaceShell.tsx", import.meta.url), "utf8");
const legalSource = readFileSync(new URL("./src/pages/Legal.tsx", import.meta.url), "utf8");
const cookieSource = readFileSync(new URL("./src/components/CookieConsent.tsx", import.meta.url), "utf8");

describe("Alpha Market public legal and cookie experience", () => {
  it("registers both public legal routes and exposes their footer links", () => {
    expect(appSource).toContain('path="/terms-of-use"');
    expect(appSource).toContain('path="/privacy-policy"');
    expect(shellSource).toContain('href="/terms-of-use"');
    expect(shellSource).toContain('href="/privacy-policy"');
  });

  it("persists explicit cookie acceptance and identifies the public brand", () => {
    expect(cookieSource).toContain('alpha-market-cookie-consent-v1');
    expect(cookieSource).toContain('localStorage.setItem');
    expect(cookieSource).toContain('Alpha Market');
  });

  it("retains the legal parent and required KYC, dropshipping, escrow, and crypto clauses", () => {
    expect(legalSource).toContain('Alpha Collective Corporation');
    expect(legalSource).toContain('Smile ID');
    expect(legalSource).toContain('dropshipping fulfilment');
    expect(legalSource).toContain('buyer confirms receipt');
    expect(legalSource).toContain('not withdrawable to a fiat bank account');
  });
});
