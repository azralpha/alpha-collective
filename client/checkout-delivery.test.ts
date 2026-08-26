import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("checkout delivery and address interface", () => {
  it("uses the cascading Nigerian address fields and dynamic delivery selection", () => {
    const source = readFileSync(new URL("../client/src/pages/Checkout.tsx", import.meta.url), "utf8");

    expect(source).toContain("NIGERIA_COUNTRY");
    expect(source).toContain("NIGERIA_STATES");
    expect(source).toContain("getNigerianLgas");
    expect(source).toContain("Standard Delivery (3–5 days)");
    expect(source).toContain("Express Delivery (1–2 days)");
    expect(source).toContain("Ask about this product");
    expect(source).toContain("Crypto Payment (NOWPayments)");
    expect(source).toContain("Administrator-only live test quote");
  });
});
