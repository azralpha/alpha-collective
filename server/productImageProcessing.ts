import sharp, { type Metadata } from "sharp";
import { storagePut } from "./storage";

const MAX_PRODUCT_IMAGE_BYTES = 5 * 1024 * 1024;

export class ProductImageProcessingError extends Error {}

export function decodeProductImageDataUrl(dataUrl: string) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new ProductImageProcessingError("Upload a JPG, PNG, or WebP image.");
  const data = Buffer.from(match[2], "base64");
  if (data.length === 0 || data.length > MAX_PRODUCT_IMAGE_BYTES) throw new ProductImageProcessingError("Product images must be 5 MB or smaller.");
  return data;
}

function isApprovedCjImageUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname.endsWith(".cjdropshipping.com") || url.hostname.endsWith(".aliyuncs.com") || url.hostname.endsWith(".cjdropshipping.cn"));
  } catch {
    return false;
  }
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
  return sharp(source, { limitInputPixels: 32_000_000, failOn: "error" })
    .rotate()
    .resize({ width: 1920, height: 1920, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82, effort: 4 })
    .toBuffer();
}

export async function storeProcessedProductImage(input: { source: Buffer; storagePrefix: string }) {
  const processed = await watermarkAndConvertToWebp(input.source);
  return storagePut(`${input.storagePrefix}.webp`, processed, "image/webp");
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
      if (total > MAX_PRODUCT_IMAGE_BYTES) { await reader.cancel(); throw new ProductImageProcessingError("A CJ product image exceeds the 5 MB import limit."); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  if (!total) throw new ProductImageProcessingError("CJ returned an empty product image response.");
  return Buffer.concat(chunks);
}

export async function importCjProductImage(input: { imageUrl: string; storagePrefix: string }) {
  if (!isApprovedCjImageUrl(input.imageUrl)) throw new ProductImageProcessingError("CJ returned an unsupported product-image host.");
  let response: Response;
  try { response = await fetch(input.imageUrl, { redirect: "error", signal: AbortSignal.timeout(15_000) }); }
  catch { throw new ProductImageProcessingError("A CJ product image could not be downloaded."); }
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (!response.ok || declaredLength > MAX_PRODUCT_IMAGE_BYTES) throw new ProductImageProcessingError("CJ returned an unsupported or oversized product image.");
  return storeProcessedProductImage({ source: await readCjImageWithinLimit(response), storagePrefix: input.storagePrefix });
}
