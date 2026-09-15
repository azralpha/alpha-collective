import { describe, expect, it } from "vitest";
import { FixedWindowRateLimiter, getPublicCatalogueRevision, IMMUTABLE_PRODUCT_IMAGE_CACHE_CONTROL, isImmutableProductImageKey, parseDatabasePoolLimit, PUBLIC_CATALOGUE_CACHE_CONTROL, revalidatePublicCataloguePaths } from "./performanceControls";

describe("high-traffic performance controls", () => {
  it("bounds the MySQL connection pool to a safe per-instance range", () => {
    expect(parseDatabasePoolLimit(undefined)).toBe(5);
    expect(parseDatabasePoolLimit("0")).toBe(1);
    expect(parseDatabasePoolLimit("9")).toBe(9);
    expect(parseDatabasePoolLimit("999")).toBe(20);
  });

  it("allows immutable caching only for fingerprinted public product WebP assets", () => {
    expect(isImmutableProductImageKey("vendor-products/7/item_12345678.webp")).toBe(true);
    expect(isImmutableProductImageKey("official-products/1/cj/item_ab12cd34.webp")).toBe(true);
    expect(isImmutableProductImageKey("kyc-private/7/id_12345678.webp")).toBe(false);
    expect(IMMUTABLE_PRODUCT_IMAGE_CACHE_CONTROL).toContain("immutable");
    expect(PUBLIC_CATALOGUE_CACHE_CONTROL).toContain("max-age=0");
    expect(PUBLIC_CATALOGUE_CACHE_CONTROL).toContain("must-revalidate");
  });

  it("increments the local public catalogue revision after a publication mutation", () => {
    const before = getPublicCatalogueRevision();
    expect(revalidatePublicCataloguePaths()).toBe(before + 1);
  });

  it("blocks only requests beyond a fixed rate window and reports a retry period", () => {
    const limiter = new FixedWindowRateLimiter();
    expect(limiter.consume({ key: "checkout:7", limit: 2, windowMs: 60_000, now: 1_000 }).allowed).toBe(true);
    expect(limiter.consume({ key: "checkout:7", limit: 2, windowMs: 60_000, now: 1_001 }).allowed).toBe(true);
    expect(limiter.consume({ key: "checkout:7", limit: 2, windowMs: 60_000, now: 1_002 })).toMatchObject({ allowed: false, retryAfterSeconds: 60 });
    expect(limiter.consume({ key: "checkout:7", limit: 2, windowMs: 60_000, now: 61_001 }).allowed).toBe(true);
  });
});
