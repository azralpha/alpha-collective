import { describe, expect, it } from "vitest";
import { HERO_CAROUSEL_SLIDES, nextHeroSlide } from "./src/lib/heroCarousel";

describe("homepage hero carousel", () => {
  it("contains ten durable lifestyle slides and loops from the final slide to the first", () => {
    expect(HERO_CAROUSEL_SLIDES.length).toBeGreaterThanOrEqual(10);
    expect(HERO_CAROUSEL_SLIDES.every(slide => slide.src.startsWith("/hero/"))).toBe(true);
    expect(nextHeroSlide(HERO_CAROUSEL_SLIDES.length - 1)).toBe(0);
  });
});
