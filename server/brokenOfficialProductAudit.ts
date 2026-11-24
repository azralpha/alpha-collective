export const AUDITED_BROKEN_OFFICIAL_PRODUCT_COUNT = 101;

export type AuditedOfficialProduct = {
  id: number;
  status: string;
  isPublished: number;
  publicationStatus: string;
  imageUrl: string | null;
  imageUrls: string[] | null;
};

export function getProductGalleryUrls(product: Pick<AuditedOfficialProduct, "imageUrl" | "imageUrls">) {
  return Array.from(new Set([product.imageUrl, ...(product.imageUrls ?? [])]
    .map(url => url?.trim())
    .filter((url): url is string => Boolean(url))));
}

export function isLegacyOfficialProductImageUrl(value: string, allowedOrigins: ReadonlySet<string>, baseOrigin: string) {
  try {
    const url = new URL(value, baseOrigin);
    return url.protocol === "https:" && allowedOrigins.has(url.origin) &&
      url.pathname.startsWith("/uploads/official-products/") && !url.search && !url.hash &&
      !url.username && !url.password;
  } catch {
    return false;
  }
}

async function isConfirmed404(url: string, fetchImpl: typeof fetch) {
  try {
    const response = await fetchImpl(url, {
      method: "HEAD",
      redirect: "manual",
      signal: AbortSignal.timeout(8_000),
    });
    return response.status === 404;
  } catch {
    return false;
  }
}

async function mapWithConcurrency<T, R>(values: T[], concurrency: number, worker: (value: T) => Promise<R>) {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    while (nextIndex < values.length) {
      const index = nextIndex++;
      results[index] = await worker(values[index]);
    }
  }));
  return results;
}

/** Returns the exact currently published 101 official listings only when all their image URLs are confirmed 404s. */
export async function selectAuditedBrokenOfficialProducts(
  products: AuditedOfficialProduct[],
  options: {
    allowedOrigins: ReadonlySet<string>;
    baseOrigin: string;
    fetchImpl?: typeof fetch;
    expectedCount?: number;
  },
) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const publishedLegacyProducts = products.filter(product => {
    if (product.status !== "active" || product.isPublished !== 1 || product.publicationStatus !== "APPROVED") return false;
    const urls = getProductGalleryUrls(product);
    const primary = product.imageUrl?.trim() || product.imageUrls?.[0]?.trim();
    return Boolean(primary) && urls.length > 0 && urls.every(url =>
      isLegacyOfficialProductImageUrl(url, options.allowedOrigins, options.baseOrigin));
  });

  const verified = await mapWithConcurrency(publishedLegacyProducts, 12, async product => {
    const urls = getProductGalleryUrls(product);
    const results = await Promise.all(urls.map(url => isConfirmed404(url, fetchImpl)));
    return results.every(Boolean) ? product : null;
  });
  const candidates = verified.filter((product): product is AuditedOfficialProduct => product !== null);
  const expectedCount = options.expectedCount ?? AUDITED_BROKEN_OFFICIAL_PRODUCT_COUNT;
  if (candidates.length !== expectedCount) {
    throw new Error(`Safety check stopped: expected exactly ${expectedCount} currently published official listings with every primary/gallery image confirmed HTTP 404, found ${candidates.length}. No products were changed.`);
  }
  return candidates;
}
