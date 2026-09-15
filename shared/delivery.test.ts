import { describe, expect, it } from "vitest";
import { calculateDeliveryQuote } from "./delivery";
import { NIGERIA_STATES, formatNigerianDeliveryAddress, getNigerianLgas, isNigerianLga, isNigerianState } from "./nigeriaAddress";

describe("Nigeria delivery and address rules", () => {
  it("uses the intra-state rate for Lagos deliveries up to the 2 kg allowance", () => {
    expect(calculateDeliveryQuote({ destinationState: "Lagos", weightKg: 2, serviceTier: "standard" })).toMatchObject({ zone: "intra_state", baseRate: 9500, weightSurcharge: 0, deliveryFee: 9500 });
  });

  it("adds a surcharge for each extra kilogram and applies the express multiplier", () => {
    expect(calculateDeliveryQuote({ destinationState: "Osun", weightKg: 3, serviceTier: "standard" })).toMatchObject({ zone: "regional", weightSurcharge: 1000, deliveryFee: 16000 });
    expect(calculateDeliveryQuote({ destinationState: "Kano", weightKg: 4.1, serviceTier: "express" })).toMatchObject({ zone: "far", weightSurcharge: 3000, deliveryFee: 40500 });
  });

  it("provides validated Nigerian address choices and a standardized stored address", () => {
    expect(NIGERIA_STATES).toHaveLength(37);
    expect(NIGERIA_STATES).toContain("Federal Capital Territory");
    expect(isNigerianState("Lagos")).toBe(true);
    expect(getNigerianLgas("Lagos")).toContain("Ikeja");
    expect(isNigerianLga("Lagos", "Ikeja")).toBe(true);
    expect(formatNigerianDeliveryAddress({ state: "Lagos", lga: "Ikeja", streetDetails: " 12 Oyan Road, Olomoba Compound " })).toBe("NIGERIA, LAGOS, IKEJA, 12 Oyan Road, Olomoba Compound");
  });
});
