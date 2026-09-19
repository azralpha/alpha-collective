export const HERO_CAROUSEL_SLIDES = [
  { src: "/hero/hero-bundled-01.jpg", label: "A young Nigerian shopper choosing colorful fashion" },
  { src: "/hero/hero-bundled-02.jpg", label: "Young Nigerians shopping together in a modern mall" },
  { src: "/hero/hero-bundled-03.jpg", label: "A Nigerian family shopping for fresh groceries" },
  { src: "/hero/hero-bundled-04.jpg", label: "A couple browsing a modern home showroom" },
  { src: "/hero/hero-bundled-05.jpg", label: "A vibrant Lagos market scene" },
  { src: "/hero/hero-bundled-06.jpg", label: "Friends exploring a colorful beauty shop" },
  { src: "/hero/hero-bundled-07.jpg", label: "A shopper testing headphones in an electronics store" },
  { src: "/hero/hero-bundled-08.jpg", label: "A mother and daughter shopping in a modern mall" },
  { src: "/hero/hero-bundled-09.jpg", label: "A Nigerian vendor sharing handmade market goods" },
  { src: "/hero/hero-bundled-10.jpg", label: "Friends choosing sneakers in a modern retail store" },
  { src: "/hero/hero-african-sneaker-store.jpg", label: "Young Nigerians browsing a sneaker store" },
  { src: "/hero/hero-african-tech-market.jpg", label: "A shopper comparing phones in a modern electronics market" },
] as const;

export function nextHeroSlide(currentSlide: number, totalSlides = HERO_CAROUSEL_SLIDES.length) {
  return totalSlides > 0 ? (currentSlide + 1) % totalSlides : 0;
}
