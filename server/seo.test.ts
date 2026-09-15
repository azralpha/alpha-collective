import { describe, expect, it } from "vitest";
import { buildSitemapXml, getSeoHead, renderSeoHead } from "./seo";
import type { MarketplaceProduct } from "@shared/marketplace";

const officialProduct: MarketplaceProduct = {
  id: "official-51",
  title: "Portable Blender",
  vendor: "Alpha Market Official",
  category: "Gadgets",
  price: 15900,
  imageUrl: "/manus-storage/blender.webp",
  imageUrls: ["/manus-storage/blender.webp"],
  description: "A compact blender for quick smoothies at home.",
  detail: "A compact blender for quick smoothies at home.",
  stockQuantity: 4,
};

describe("technical SEO", () => {
  it("emits only canonical category and published product URLs in the sitemap", () => {
    const sitemap = buildSitemapXml([officialProduct]);
    expect(sitemap).toContain("/shop?category=gadgets");
    expect(sitemap).toContain("/product/official-51");
    expect(sitemap).not.toContain("/admin/");
  });

  it("renders product metadata and structured data with Naira price and availability", () => {
    const head = renderSeoHead({ title: "Portable Blender | Alpha Market", description: officialProduct.description, canonicalPath: "/product/official-51", product: officialProduct });
    expect(head).toContain('<meta name="description"');
    expect(head).toContain('"priceCurrency":"NGN"');
    expect(head).toContain('"price":"15900.00"');
    expect(head).toContain('https://schema.org/InStock');
    expect(head).not.toContain("supplier");
  });

  it("marks private paths as non-indexable", async () => {
    await expect(getSeoHead("/admin/official-products")).resolves.toMatchObject({ noindex: true });
  });
});
