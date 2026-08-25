export const PUBLIC_CATALOGUE_CACHE_CONTROL = "public, max-age=30, s-maxage=60, stale-while-revalidate=300";
export const PRIVATE_API_CACHE_CONTROL = "no-store";
export const IMMUTABLE_PRODUCT_IMAGE_CACHE_CONTROL = "public, max-age=31536000, immutable";

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
