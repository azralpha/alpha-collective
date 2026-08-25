export const HERO_CAROUSEL_SLIDES = [
  { src: "/manus-storage/hero-african-mall_333fd599.jpg", label: "African shoppers in a contemporary mall" },
  { src: "/manus-storage/hero-nigerian-shopping-bags_08a3d81b.jpg", label: "Nigerian friends shopping together" },
  { src: "/manus-storage/hero-african-market_2b81507d.jpg", label: "A vibrant African retail market" },
  { src: "/manus-storage/hero-african-supermarket_41b39dd1.jpg", label: "A modern Nigerian supermarket shopper" },
] as const;

export function nextHeroSlide(currentSlide: number, totalSlides = HERO_CAROUSEL_SLIDES.length) {
  return totalSlides > 0 ? (currentSlide + 1) % totalSlides : 0;
}
