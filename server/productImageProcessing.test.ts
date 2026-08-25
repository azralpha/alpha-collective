import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./storage", () => ({
  storageGetSignedUrl: vi.fn(async () => "https://watermark.test/logo.png"),
  storagePut: vi.fn(),
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
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
});
