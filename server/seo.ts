import type { Request, Response } from "express";
import { listActiveOfficialProducts, listApprovedVendorProducts } from "./db";
import { getMarketplaceCategoryMetadata, MARKETPLACE_CATEGORIES, MARKETPLACE_PRODUCTS, type MarketplaceProduct } from "@shared/marketplace";
import { buildProductJsonLd, cleanSeoText, SEO_DEFAULT_DESCRIPTION, SEO_SITE_NAME } from "@shared/seo";

const DEFAULT_CANONICAL_ORIGIN = "https://alphashop-3pdenj2y.manus.space";

export type SeoHead = {
  title: string;
  description: string;
  canonicalPath: string;
  noindex?: boolean;
  product?: MarketplaceProduct;
};

export function canonicalOrigin(): string {
  return (process.env.PUBLIC_APP_URL || DEFAULT_CANONICAL_ORIGIN).replace(/\/+$/, "");
}

function absoluteUrl(value: string): string {
  if (/^https?:\/\//i.test(value)) return value;
  return `${canonicalOrigin()}${value.startsWith("/") ? value : `/${value}`}`;
}

function htmlEscape(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function jsonForHtml(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");
}

function vendorCatalogue(rows: Awaited<ReturnType<typeof listApprovedVendorProducts>>): MarketplaceProduct[] {
  return rows.flatMap(row => {
    const imageUrls = (row.imageUrls?.length ? row.imageUrls : row.imageUrl ? [row.imageUrl] : []).filter(Boolean);
    if (!imageUrls.length) return [];
    return [{
      id: `vendor-${row.id}`,
      title: row.title,
      vendor: row.vendor,
      category: row.category,
      price: row.price,
      badge: row.lightningSeller ? "Lightning Seller • Verified" : "Verified seller find",
      imageUrl: imageUrls[0],
      imageUrls,
      description: row.description,
      detail: row.description,
    }];
  });
}

function officialCatalogue(rows: Awaited<ReturnType<typeof listActiveOfficialProducts>>): MarketplaceProduct[] {
  return rows.flatMap(row => {
    const imageUrls = (row.imageUrls?.length ? row.imageUrls : row.imageUrl ? [row.imageUrl] : []).filter(Boolean);
    if (!imageUrls.length) return [];
    return [{
      id: `official-${row.id}`,
      title: row.title,
      vendor: "Alpha Market Official",
      category: row.category,
      price: row.price,
      formerPrice: row.formerPrice ?? undefined,
      badge: row.badge ?? "Alpha Market pick",
      imageUrl: imageUrls[0],
      imageUrls,
      description: row.description,
      detail: row.detail,
      stockQuantity: row.stockQuantity ?? undefined,
    }];
  });
}

/** Returns only storefront-safe, published catalogue data. Supplier information is never read or emitted. */
export async function getPublishedSeoCatalogue(): Promise<MarketplaceProduct[]> {
  const [vendorProducts, officialProducts] = await Promise.all([listApprovedVendorProducts(), listActiveOfficialProducts()]);
  return [...MARKETPLACE_PRODUCTS, ...officialCatalogue(officialProducts), ...vendorCatalogue(vendorProducts)];
}

function categoryFromUrl(url: URL): (typeof MARKETPLACE_CATEGORIES)[number] | null {
  const category = url.searchParams.get("category")?.trim().toLowerCase();
  return MARKETPLACE_CATEGORIES.find(value => getMarketplaceCategoryMetadata(value).slug === category || value.toLowerCase() === category) ?? null;
}

export async function getSeoHead(requestUrl: string): Promise<SeoHead> {
  const url = new URL(requestUrl, canonicalOrigin());
  const path = url.pathname.replace(/\/+$/, "") || "/";
  if (path === "/") return { title: `${SEO_SITE_NAME} | Nigerian marketplace finds`, description: SEO_DEFAULT_DESCRIPTION, canonicalPath: "/" };
  if (path === "/shop") {
    const category = categoryFromUrl(url);
    return category
      ? { title: `Shop ${category} in Nigeria | ${SEO_SITE_NAME}`, description: `Browse ${category.toLowerCase()} finds and practical prices from independent sellers on ${SEO_SITE_NAME}.`, canonicalPath: `/shop?category=${getMarketplaceCategoryMetadata(category).slug}` }
      : { title: `Shop local finds in Nigeria | ${SEO_SITE_NAME}`, description: `Browse fashion, gadgets, beauty, home, vehicles, and pet essentials on ${SEO_SITE_NAME}.`, canonicalPath: "/shop" };
  }
  if (path.startsWith("/product/")) {
    const productId = decodeURIComponent(path.slice("/product/".length));
    const product = (await getPublishedSeoCatalogue()).find(item => item.id === productId);
    if (product) return { title: `${cleanSeoText(product.title, 58)} | ${SEO_SITE_NAME}`, description: cleanSeoText(product.description || product.detail, 155), canonicalPath: `/product/${encodeURIComponent(product.id)}`, product };
    return { title: `Product not found | ${SEO_SITE_NAME}`, description: SEO_DEFAULT_DESCRIPTION, canonicalPath: path, noindex: true };
  }
  if (path === "/terms-of-use") return { title: `Terms of Use | ${SEO_SITE_NAME}`, description: `Read the ${SEO_SITE_NAME} marketplace terms of use.`, canonicalPath: path };
  if (path === "/privacy-policy") return { title: `Privacy Policy | ${SEO_SITE_NAME}`, description: `Read the ${SEO_SITE_NAME} privacy policy.`, canonicalPath: path };
  if (["/cart", "/checkout", "/wallet", "/rewards", "/kyc"].includes(path) || path.startsWith("/admin/") || path.startsWith("/vendor/")) {
    return { title: SEO_SITE_NAME, description: SEO_DEFAULT_DESCRIPTION, canonicalPath: path, noindex: true };
  }
  return { title: SEO_SITE_NAME, description: SEO_DEFAULT_DESCRIPTION, canonicalPath: path, noindex: true };
}

export async function getSeoHeadSafely(requestUrl: string): Promise<SeoHead> {
  try {
    return await getSeoHead(requestUrl);
  } catch (error) {
    console.error("[SEO] Could not build route-specific metadata:", error);
    const path = new URL(requestUrl, canonicalOrigin()).pathname.replace(/\/+$/, "") || "/";
    return { title: SEO_SITE_NAME, description: SEO_DEFAULT_DESCRIPTION, canonicalPath: path };
  }
}

export function renderSeoHead(head: SeoHead): string {
  const title = htmlEscape(cleanSeoText(head.title, 70) || SEO_SITE_NAME);
  const description = htmlEscape(cleanSeoText(head.description, 200));
  const canonical = htmlEscape(`${canonicalOrigin()}${head.canonicalPath}`);
  const tags = [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}" />`,
    `<link rel="canonical" href="${canonical}" />`,
    `<meta property="og:type" content="${head.product ? "product" : "website"}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${canonical}" />`,
    `<meta property="og:site_name" content="${SEO_SITE_NAME}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
  ];
  if (head.product) {
    const image = absoluteUrl(head.product.imageUrl);
    tags.push(`<meta property="og:image" content="${htmlEscape(image)}" />`);
    tags.push(`<meta name="twitter:image" content="${htmlEscape(image)}" />`);
    tags.push(`<script id="alpha-market-product-jsonld" type="application/ld+json">${jsonForHtml(buildProductJsonLd(head.product, `${canonicalOrigin()}${head.canonicalPath}`, absoluteUrl))}</script>`);
  }
  if (head.noindex) tags.push(`<meta name="robots" content="noindex, follow" />`);
  return tags.join("\n");
}

export function injectSeoHead(template: string, head: SeoHead): string {
  return template.replace("<!--seo-head-->", () => renderSeoHead(head));
}

export function buildSitemapXml(products: MarketplaceProduct[]): string {
  const origin = canonicalOrigin();
  const urls = [
    "/",
    "/shop",
    ...MARKETPLACE_CATEGORIES.map(category => `/shop?category=${getMarketplaceCategoryMetadata(category).slug}`),
    ...products.map(product => `/product/${encodeURIComponent(product.id)}`),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${Array.from(new Set(urls)).map(url => `  <url><loc>${htmlEscape(`${origin}${url}`)}</loc></url>`).join("\n")}\n</urlset>`;
}

export function registerSeoRoutes(app: { get: (path: string, handler: (req: Request, res: Response) => void | Promise<void>) => unknown }) {
  app.get("/sitemap.xml", async (_req, res) => {
    const products = await getPublishedSeoCatalogue();
    res.type("application/xml").set("Cache-Control", "public, max-age=300, stale-while-revalidate=600").send(buildSitemapXml(products));
  });
  app.get("/robots.txt", (_req, res) => {
    res.type("text/plain").set("Cache-Control", "public, max-age=300, stale-while-revalidate=600").send(`User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /vendor/\nDisallow: /wallet\nDisallow: /checkout\nDisallow: /cart\nDisallow: /kyc\nSitemap: ${canonicalOrigin()}/sitemap.xml\n`);
  });
}
