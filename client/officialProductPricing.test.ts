import { describe, expect, it } from "vitest";
import { hasManualRetailPrice } from "./src/lib/officialProductPricing";

describe("official product manual retail price", () => {
  it("requires a separately entered whole-Naira retail price before an imported draft can be saved", () => {
    expect(hasManualRetailPrice("")).toBe(false);
    expect(hasManualRetailPrice("0")).toBe(false);
    expect(hasManualRetailPrice("499")).toBe(false);
    expect(hasManualRetailPrice("9.50")).toBe(false);
    expect(hasManualRetailPrice("18500")).toBe(true);
  });
});
