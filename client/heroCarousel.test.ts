import { describe, expect, it } from "vitest";
import { HERO_CAROUSEL_SLIDES, nextHeroSlide } from "./src/lib/heroCarousel";

describe("homepage hero carousel", () => {
  it("contains four durable lifestyle slides and loops from the final slide to the first", () => {
    expect(HERO_CAROUSEL_SLIDES).toHaveLength(4);
    expect(HERO_CAROUSEL_SLIDES.every(slide => slide.src.startsWith("/manus-storage/"))).toBe(true);
    expect(nextHeroSlide(HERO_CAROUSEL_SLIDES.length - 1)).toBe(0);
  });
});
