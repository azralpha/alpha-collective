import { describe, expect, it, vi } from "vitest";
import { selectAuditedBrokenOfficialProducts, type AuditedOfficialProduct } from "./brokenOfficialProductAudit";

const origin = "https://alphamarket.name.ng";
const allowedOrigins = new Set([origin]);

function product(id: number, overrides: Partial<AuditedOfficialProduct> = {}): AuditedOfficialProduct {
  return {
    id,
    status: "active",
    isPublished: 1,
    publicationStatus: "APPROVED",
    imageUrl: `${origin}/uploads/official-products/${id}/primary.webp`,
    imageUrls: [`${origin}/uploads/official-products/${id}/primary.webp`, `${origin}/uploads/official-products/${id}/gallery.webp`],
    ...overrides,
  };
}

function fetchWithStatus(status: number) {
  return vi.fn(async () => new Response(null, { status }));
}

describe("audited broken official product image selection", () => {
  it("selects exactly 101 published official records only when every gallery URL confirms 404", async () => {
    const fetchImpl = fetchWithStatus(404);
    const candidates = await selectAuditedBrokenOfficialProducts(
      Array.from({ length: 101 }, (_, index) => product(index + 1)),
      { allowedOrigins, baseOrigin: origin, fetchImpl },
    );
    expect(candidates.map(item => item.id)).toEqual(Array.from({ length: 101 }, (_, index) => index + 1));
    expect(fetchImpl).toHaveBeenCalledTimes(202);
  });

  it("fails closed if one primary or gallery image is not confirmed as 404", async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      return new Response(null, { status: url.endsWith("/gallery.webp") && url.includes("/101/") ? 200 : 404 });
    });
    await expect(selectAuditedBrokenOfficialProducts(
      Array.from({ length: 101 }, (_, index) => product(index + 1)),
      { allowedOrigins, baseOrigin: origin, fetchImpl },
    )).rejects.toThrow("found 100");
  });

  it("fails closed if the verified target count is short or over the expected count", async () => {
    const fetchImpl = fetchWithStatus(404);
    await expect(selectAuditedBrokenOfficialProducts(
      Array.from({ length: 102 }, (_, index) => product(index + 1)),
      { allowedOrigins, baseOrigin: origin, fetchImpl },
    )).rejects.toThrow("found 102");
    await expect(selectAuditedBrokenOfficialProducts(
      Array.from({ length: 100 }, (_, index) => product(index + 1)),
      { allowedOrigins, baseOrigin: origin, fetchImpl },
    )).rejects.toThrow("found 100");
  });

  it("excludes drafts, unpublished records, and URLs outside the exact legacy image path", async () => {
    const fetchImpl = fetchWithStatus(404);
    const records = [
      product(1, { status: "draft" }),
      product(2, { isPublished: 0 }),
      product(3, { imageUrl: `${origin}/uploads/vendor-products/3/photo.webp` }),
      ...Array.from({ length: 101 }, (_, index) => product(index + 4)),
    ];
    const candidates = await selectAuditedBrokenOfficialProducts(records, { allowedOrigins, baseOrigin: origin, fetchImpl });
    expect(candidates).toHaveLength(101);
    expect(candidates.some(item => item.id < 4)).toBe(false);
  });

  it("does not treat redirects, timeouts, or other HTTP errors as confirmed 404s", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 302 }));
    await expect(selectAuditedBrokenOfficialProducts(
      Array.from({ length: 101 }, (_, index) => product(index + 1)),
      { allowedOrigins, baseOrigin: origin, fetchImpl },
    )).rejects.toThrow("found 0");
  });
});
