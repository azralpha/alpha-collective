/**
 * The marketplace is an Express app, not a Next.js deployment, so revalidatePath is unavailable.
 * Zero freshness plus must-revalidate requires browser and intermediary caches to validate catalogue
 * responses with the origin before reuse, preserving immediate publication changes without page builds.
 */
export const PUBLIC_CATALOGUE_CACHE_CONTROL = "public, max-age=0, s-maxage=0, must-revalidate";
export const PRIVATE_API_CACHE_CONTROL = "no-store";
export const IMMUTABLE_PRODUCT_IMAGE_CACHE_CONTROL = "public, max-age=31536000, immutable";

let publicCatalogueRevision = 0;

/** Marks a publication change for local diagnostics; response freshness is guaranteed by Cache-Control. */
export function revalidatePublicCataloguePaths() {
  publicCatalogueRevision += 1;
  return publicCatalogueRevision;
}

export function getPublicCatalogueRevision() {
  return publicCatalogueRevision;
}

export function parseDatabasePoolLimit(value: string | undefined) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 5;
  return Math.min(20, Math.max(1, Math.floor(parsed)));
}

export function isImmutableProductImageKey(key: string) {
  return /^(?:vendor-products|official-products)\/.+_[a-f0-9]{8}\.webp$/i.test(key);
}

type RateLimitBucket = { count: number; resetAt: number };

export class FixedWindowRateLimiter {
  private readonly buckets = new Map<string, RateLimitBucket>();

  consume(input: { key: string; limit: number; windowMs: number; now?: number }) {
    const now = input.now ?? Date.now();
    const current = this.buckets.get(input.key);
    const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + input.windowMs } : current;
    bucket.count += 1;
    this.buckets.set(input.key, bucket);
    return { allowed: bucket.count <= input.limit, retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }

  clear() {
    this.buckets.clear();
  }
}
