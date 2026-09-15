import sharp, { type Metadata } from "sharp";
import { storageGetSignedUrl, storagePut } from "./storage";

const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;
const WATERMARK_ASSET_KEY = "alpha-collective-product-watermark_71c49e47.png";

export class ProductImageProcessingError extends Error {}

let watermarkBufferPromise: Promise<Buffer> | null = null;

export function decodeProductImageDataUrl(dataUrl: string) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new ProductImageProcessingError("Upload a JPG, PNG, or WebP image.");
  const data = Buffer.from(match[2], "base64");
  if (data.length === 0 || data.length > MAX_PRODUCT_IMAGE_BYTES) {
    throw new ProductImageProcessingError("Product images must be 5 MB or smaller.");
  }
  return data;
}

function isApprovedCjImageUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (
      url.hostname.endsWith(".cjdropshipping.com") ||
      url.hostname.endsWith(".aliyuncs.com") ||
      url.hostname.endsWith(".cjdropshipping.cn")
    );
  } catch {
    return false;
  }
}

async function watermarkBuffer() {
  if (!watermarkBufferPromise) {
    watermarkBufferPromise = (async () => {
      const signedUrl = await storageGetSignedUrl(WATERMARK_ASSET_KEY);
      const response = await fetch(signedUrl, { signal: AbortSignal.timeout(10_000) });
      if (!response.ok) throw new ProductImageProcessingError("The Alpha Collective watermark asset is unavailable.");
      const buffer = Buffer.from(await response.arrayBuffer());
      if (!buffer.length) throw new ProductImageProcessingError("The Alpha Collective watermark asset is empty.");
      return buffer;
    })().catch(error => {
      watermarkBufferPromise = null;
      throw error;
    });
  }
  return watermarkBufferPromise;
}

async function applyOpacity(input: Buffer, opacity: number) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let index = 3; index < data.length; index += info.channels) data[index] = Math.round(data[index] * opacity);
  return sharp(data, { raw: { width: info.width, height: info.height, channels: info.channels } }).png().toBuffer();
}

async function readCjImageWithinLimit(response: Response) {
  if (!response.body) throw new ProductImageProcessingError("CJ returned an empty product image response.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > MAX_PRODUCT_IMAGE_BYTES) {
        await reader.cancel();
        throw new ProductImageProcessingError("A CJ product image exceeds the 5 MB import limit.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  if (!total) throw new ProductImageProcessingError("CJ returned an empty product image response.");
  return Buffer.concat(chunks);
}

export async function watermarkAndConvertToWebp(source: Buffer) {
  if (!source.length || source.length > MAX_PRODUCT_IMAGE_BYTES) throw new ProductImageProcessingError("Product images must be 5 MB or smaller.");
  let metadata: Metadata;
  try {
    metadata = await sharp(source, { limitInputPixels: 32_000_000, failOn: "error" }).metadata();
  } catch {
    throw new ProductImageProcessingError("The uploaded file is not a valid product image.");
  }
  if (!metadata.width || !metadata.height) throw new ProductImageProcessingError("The product image has invalid dimensions.");

  const width = Math.min(metadata.width, 1920);
  const logoWidth = Math.min(300, Math.max(96, Math.round(width * 0.24)));
  const logo = await sharp(await watermarkBuffer()).resize({ width: logoWidth, withoutEnlargement: true }).png().toBuffer();
  const fadedLogo = await applyOpacity(logo, 0.4);
  return sharp(source, { limitInputPixels: 32_000_000, failOn: "error" })
    .rotate()
    .resize({ width: 1920, height: 1920, fit: "inside", withoutEnlargement: true })
    .composite([{ input: fadedLogo, gravity: "southeast" }])
    .webp({ quality: 82, effort: 4 })
    .toBuffer();
}

export async function storeProcessedProductImage(input: { source: Buffer; storagePrefix: string }) {
  const processed = await watermarkAndConvertToWebp(input.source);
  return storagePut(`${input.storagePrefix}.webp`, processed, "image/webp");
}

export async function importCjProductImage(input: { imageUrl: string; storagePrefix: string }) {
  if (!isApprovedCjImageUrl(input.imageUrl)) throw new ProductImageProcessingError("CJ returned an unsupported product-image host.");
  let response: Response;
  try {
    response = await fetch(input.imageUrl, { redirect: "error", signal: AbortSignal.timeout(15_000) });
  } catch {
    throw new ProductImageProcessingError("A CJ product image could not be downloaded.");
  }
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (!response.ok || declaredLength > MAX_PRODUCT_IMAGE_BYTES) {
    throw new ProductImageProcessingError("CJ returned an unsupported or oversized product image.");
  }
  const source = await readCjImageWithinLimit(response);
  return storeProcessedProductImage({ source, storagePrefix: input.storagePrefix });
}
