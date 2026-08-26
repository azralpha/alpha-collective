import { useEffect } from "react";
import type { MarketplaceProduct } from "@shared/marketplace";
import { buildProductJsonLd, cleanSeoText, SEO_DEFAULT_DESCRIPTION, SEO_SITE_NAME } from "@shared/seo";

type DocumentSeo = {
  title: string;
  description: string;
  canonicalPath: string;
  product?: MarketplaceProduct;
};

function setMeta(selector: string, attribute: "name" | "property", value: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, value);
    document.head.appendChild(element);
  }
  element.content = content;
}

export function useDocumentSeo({ title, description, canonicalPath, product }: DocumentSeo) {
  useEffect(() => {
    const pageTitle = cleanSeoText(title, 70) || SEO_SITE_NAME;
    const pageDescription = cleanSeoText(description || SEO_DEFAULT_DESCRIPTION, 200);
    const canonical = `${window.location.origin}${canonicalPath}`;
    document.title = pageTitle;
    setMeta('meta[name="description"]', "name", "description", pageDescription);
    setMeta('meta[property="og:title"]', "property", "og:title", pageTitle);
    setMeta('meta[property="og:description"]', "property", "og:description", pageDescription);
    setMeta('meta[property="og:url"]', "property", "og:url", canonical);
    setMeta('meta[name="twitter:title"]', "name", "twitter:title", pageTitle);
    setMeta('meta[name="twitter:description"]', "name", "twitter:description", pageDescription);
    let canonicalLink = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement("link");
      canonicalLink.rel = "canonical";
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.href = canonical;
    const previous = document.getElementById("alpha-market-product-jsonld") as HTMLScriptElement | null;
    if (product) {
      const script = previous ?? document.createElement("script");
      script.id = "alpha-market-product-jsonld";
      script.type = "application/ld+json";
      script.textContent = JSON.stringify(buildProductJsonLd(product, canonical, imageUrl => new URL(imageUrl, window.location.origin).toString()));
      if (!previous) document.head.appendChild(script);
    } else {
      previous?.remove();
    }
  }, [canonicalPath, description, product, title]);
}
