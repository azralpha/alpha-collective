import { describe, expect, it } from "vitest";
import { parseGeminiProductEnhancement } from "./geminiProductEnhancer";

describe("Gemini product enhancement parsing", () => {
  it("normalizes valid structured output into safe distinct product-copy fields", () => {
    const enhancement = parseGeminiProductEnhancement(JSON.stringify({
      cleanTitle: "  Pocket Blend Mini  ",
      seoDescription: "A compact blender for quick drinks at home. Its portable form keeps everyday blending simple.",
      metaDescription: "A compact portable blender for quick drinks at home, available on Alpha Market.",
      suggestedTags: ["blender", "portable", "kitchen", "smoothie", "drinkware"],
    }));
    expect(enhancement.cleanTitle).toBe("Pocket Blend Mini");
    expect(enhancement.suggestedTags).toEqual(["blender", "portable", "kitchen", "smoothie", "drinkware"]);
  });

  it("rejects incomplete or invalid model output instead of persisting it", () => {
    expect(() => parseGeminiProductEnhancement(JSON.stringify({ cleanTitle: "Only title" }))).toThrow();
    expect(() => parseGeminiProductEnhancement(JSON.stringify({
      cleanTitle: "Pocket Blend Mini",
      seoDescription: "A compact blender for quick drinks at home. Its portable form keeps everyday blending simple.",
      metaDescription: "A compact portable blender for quick drinks at home, available on Alpha Market.",
      suggestedTags: ["blender", "blender", "kitchen", "smoothie", "drinkware"],
    }))).toThrow("exactly five distinct");
  });
});
