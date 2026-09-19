export const HERO_CAROUSEL_SLIDES = [
  { src: "/manus-storage/hero-african-mall_333fd599.jpg", label: "African shoppers in a contemporary mall" },
  { src: "/manus-storage/hero-nigerian-shopping-bags_08a3d81b.jpg", label: "Nigerian friends shopping together" },
  { src: "/manus-storage/hero-african-market_2b81507d.jpg", label: "A vibrant African retail market" },
  { src: "/manus-storage/hero-african-supermarket_41b39dd1.jpg", label: "A modern Nigerian supermarket shopper" },
  { src: "/manus-storage/hero-african-fashion-boutique_98c33d1d.jpg", label: "A contemporary African fashion boutique" },
  { src: "/manus-storage/hero-african-electronics_37ccfaf7.jpg", label: "A modern African electronics shopper" },
  { src: "/manus-storage/hero-african-beauty-retail_37f0e9cb.jpg", label: "African friends in a beauty store" },
  { src: "/manus-storage/hero-african-furniture_0134f857.jpg", label: "A modern African home-furnishing showroom" },
  { src: "/manus-storage/hero-african-artisan-market_6beb1352.jpg", label: "An African artisan retail market" },
  { src: "/manus-storage/hero-african-family-grocery_ed013a3a.jpg", label: "An African family grocery shopping" },
  { src: "/manus-storage/hero-african-sneaker-store_6f44d735.jpg", label: "Young Nigerians browsing a sneaker store" },
  { src: "/manus-storage/hero-african-tech-market_2632f9e3.jpg", label: "A shopper comparing phones in a modern electronics market" },
] as const;

export function nextHeroSlide(currentSlide: number, totalSlides = HERO_CAROUSEL_SLIDES.length) {
  return totalSlides > 0 ? (currentSlide + 1) % totalSlides : 0;
}
