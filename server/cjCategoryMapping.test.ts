import { describe, expect, it } from "vitest";
import { classifyCjCategory, validateCjCategory } from "./cjCategoryMapping";

describe("CJ category mapping", () => {
  it("maps approved CJ category families to the matching Alpha Market category", () => {
    expect(classifyCjCategory({ threeCategoryName: "Audio & Headphones" })).toMatchObject({ kind: "approved", marketplaceCategory: "Gadgets" });
    expect(classifyCjCategory({ twoCategoryName: "Health, Beauty & Hair", threeCategoryName: "Skin Care" })).toMatchObject({ kind: "approved", marketplaceCategory: "Beauty" });
    expect(classifyCjCategory({ threeCategoryName: "Pet Supplies" })).toMatchObject({ kind: "approved", marketplaceCategory: "Animals & Pets" });
    expect(classifyCjCategory({ threeCategoryName: "Automobiles & Motorcycles" })).toMatchObject({ kind: "approved", marketplaceCategory: "Vehicles" });
  });

  it("blocks deferred CJ families before approved keyword rules can classify them", () => {
    expect(classifyCjCategory({ oneCategoryName: "Sports & Outdoors", threeCategoryName: "Cycling" }).kind).toBe("blocked");
    expect(classifyCjCategory({ oneCategoryName: "Health, Beauty & Hair", threeCategoryName: "Vitamin Supplements" }).kind).toBe("blocked");
    expect(classifyCjCategory({ oneCategoryName: "Toys, Kids & Babies", threeCategoryName: "Kids Shoes" }).kind).toBe("blocked");
    expect(classifyCjCategory({ oneCategoryName: "Musical Instruments", threeCategoryName: "Guitars" }).kind).toBe("blocked");
  });

  it("rejects a CJ product mapped to a different requested Alpha Market category", () => {
    expect(() => validateCjCategory({ threeCategoryName: "Women's Clothing" }, "Gadgets")).toThrow("belongs to Fashion");
    expect(() => validateCjCategory({ threeCategoryName: "Sports & Outdoors" }, "Gadgets")).toThrow("reserved for a future Alpha Market category");
  });
});
