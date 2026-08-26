import type { MarketplaceProduct } from "./marketplace";

export const SEO_SITE_NAME = "Alpha Market";
export const SEO_DEFAULT_DESCRIPTION = "Discover local finds, practical prices, and independent sellers across Nigeria on Alpha Market.";

export function cleanSeoText(value: string, limit: number): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= limit) return normalized;
  const boundary = normalized.lastIndexOf(" ", limit);
  return `${normalized.slice(0, boundary > limit * 0.6 ? boundary : limit).trim()}…`;
}

export type ProductJsonLd = {
  "@context": "https://schema.org";
  "@type": "Product";
  name: string;
  description: string;
  image: string[];
  category: string;
  brand: { "@type": "Brand"; name: string };
  offers: {
    "@type": "Offer";
    url: string;
    priceCurrency: "NGN";
    price: string;
    availability: "https://schema.org/InStock" | "https://schema.org/OutOfStock";
    seller: { "@type": "Organization"; name: string };
  };
};

export function buildProductJsonLd(product: MarketplaceProduct, productUrl: string, absoluteImageUrl: (imageUrl: string) => string): ProductJsonLd {
  const images = (product.imageUrls?.length ? product.imageUrls : [product.imageUrl]).filter(Boolean).map(absoluteImageUrl);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: cleanSeoText(product.title, 180),
    description: cleanSeoText(product.description || product.detail, 500),
    image: images,
    category: product.category,
    brand: { "@type": "Brand", name: SEO_SITE_NAME },
    offers: {
      "@type": "Offer",
      url: productUrl,
      priceCurrency: "NGN",
      price: product.price.toFixed(2),
      availability: product.stockQuantity === 0 ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
      seller: { "@type": "Organization", name: product.vendor },
    },
  };
}
