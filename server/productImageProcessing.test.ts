import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./storage", () => ({
  storageGetSignedUrl: vi.fn(async () => "https://watermark.test/logo.png"),
  storagePutProductImage: vi.fn(),
  storageDeleteProductImage: vi.fn(),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  vi.clearAllMocks();
});

describe("product image processing", () => {
  it("converts a product image to WebP after applying the Alpha watermark", async () => {
    const watermark = await sharp({ create: { width: 160, height: 48, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } }).png().toBuffer();
    const source = await sharp({ create: { width: 2200, height: 1400, channels: 3, background: { r: 16, g: 108, b: 62 } } }).png().toBuffer();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(watermark, { status: 200, headers: { "content-type": "image/png" } })));
    const { watermarkAndConvertToWebp } = await import("./productImageProcessing");

    const output = await watermarkAndConvertToWebp(source);
    const metadata = await sharp(output).metadata();
    expect(metadata.format).toBe("webp");
    expect(metadata.width).toBe(1920);
    expect(metadata.height).toBeLessThanOrEqual(1920);
  });

  it("processes a valid allowlisted CJ image even when CJ labels it as application/octet-stream", async () => {
    const source = await sharp({ create: { width: 1200, height: 800, channels: 3, background: { r: 16, g: 108, b: 62 } } }).jpeg().toBuffer();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(source, { status: 200, headers: { "content-type": "application/octet-stream" } }));
    vi.stubGlobal("fetch", fetchMock);
    const storage = await import("./storage");
    vi.mocked(storage.storagePutProductImage).mockResolvedValue({ key: "official-products/1/cj.webp", url: "/uploads/official-products/1/cj.webp" });
    const { importCjProductImage } = await import("./productImageProcessing");

    await expect(importCjProductImage({ imageUrl: "https://cc-west-usa.oss-us-west-1.aliyuncs.com/cj-item.jpg", storagePrefix: "official-products/1/cj" })).resolves.toMatchObject({ url: "/uploads/official-products/1/cj.webp" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("follows an approved CJ CDN redirect before processing the image", async () => {
    const source = await sharp({ create: { width: 900, height: 600, channels: 3, background: { r: 16, g: 108, b: 62 } } }).jpeg().toBuffer();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "https://cc-west-usa.oss-us-west-1.aliyuncs.com/final-image.jpg" } }))
      .mockResolvedValueOnce(new Response(source, { status: 200, headers: { "content-type": "image/jpeg" } }));
    vi.stubGlobal("fetch", fetchMock);
    const storage = await import("./storage");
    vi.mocked(storage.storagePutProductImage).mockResolvedValue({ key: "official-products/1/cj-redirect.webp", url: "/uploads/official-products/1/cj-redirect.webp" });
    const { importCjProductImage } = await import("./productImageProcessing");

    await expect(importCjProductImage({ imageUrl: "https://cc-west-usa.oss-us-west-1.aliyuncs.com/redirect-image.jpg", storagePrefix: "official-products/1/cj-redirect" })).resolves.toMatchObject({ url: "/uploads/official-products/1/cj-redirect.webp" });
    expect(fetchMock).toHaveBeenNthCalledWith(1, "https://cc-west-usa.oss-us-west-1.aliyuncs.com/redirect-image.jpg", expect.objectContaining({ redirect: "manual" }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "https://cc-west-usa.oss-us-west-1.aliyuncs.com/final-image.jpg", expect.objectContaining({ redirect: "manual" }));
  });

  it("stores every distinct supplier gallery image before returning the gallery", async () => {
    const source = await sharp({ create: { width: 900, height: 600, channels: 3, background: { r: 16, g: 108, b: 62 } } }).jpeg().toBuffer();
    const fetchMock = vi.fn(async () => new Response(source, { status: 200, headers: { "content-type": "image/jpeg" } }));
    vi.stubGlobal("fetch", fetchMock);
    const storage = await import("./storage");
    vi.mocked(storage.storagePutProductImage)
      .mockResolvedValueOnce({ key: "official-products/1/photo-0.webp", url: "https://images.alphamarket.name.ng/official-products/1/photo-0.webp" })
      .mockResolvedValueOnce({ key: "official-products/1/photo-1.webp", url: "https://images.alphamarket.name.ng/official-products/1/photo-1.webp" });
    const { importSupplierProductImageGallery } = await import("./productImageProcessing");

    await expect(importSupplierProductImageGallery({ supplier: "cj_dropshipping", imageUrls: [
      "https://cc-west-usa.oss-us-west-1.aliyuncs.com/one.jpg",
      "https://cc-west-usa.oss-us-west-1.aliyuncs.com/two.jpg",
      "https://cc-west-usa.oss-us-west-1.aliyuncs.com/one.jpg",
    ], storagePrefix: "official-products/1/gallery" })).resolves.toHaveLength(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(storage.storagePutProductImage).toHaveBeenCalledTimes(2);
    expect(storage.storageDeleteProductImage).not.toHaveBeenCalled();
  });

  it("rejects an incomplete supplier gallery and deletes successfully uploaded images", async () => {
    const source = await sharp({ create: { width: 900, height: 600, channels: 3, background: { r: 16, g: 108, b: 62 } } }).jpeg().toBuffer();
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(source, { status: 200, headers: { "content-type": "image/jpeg" } }))
      .mockResolvedValueOnce(new Response(null, { status: 404 })));
    const storage = await import("./storage");
    vi.mocked(storage.storagePutProductImage).mockResolvedValue({ key: "official-products/1/partial.webp", url: "https://images.alphamarket.name.ng/official-products/1/partial.webp" });
    const { importSupplierProductImageGallery } = await import("./productImageProcessing");

    await expect(importSupplierProductImageGallery({ supplier: "cj_dropshipping", imageUrls: [
      "https://cc-west-usa.oss-us-west-1.aliyuncs.com/available.jpg",
      "https://cc-west-usa.oss-us-west-1.aliyuncs.com/missing.jpg",
    ], storagePrefix: "official-products/1/partial" })).rejects.toThrow("unsupported or oversized product image");
    expect(storage.storageDeleteProductImage).toHaveBeenCalledWith("official-products/1/partial.webp");
  });
});
