import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { ENV } from "./_core/env";

function normalizeKey(relKey: string) {
  const key = relKey.replace(/^\/+/, "");
  if (!key || key.includes("\\") || key.split("/").some(part => part === ".." || part === ".")) throw new Error("Invalid storage key.");
  return key;
}

function absolutePath(key: string) {
  const root = path.resolve(ENV.uploadsDir);
  const file = path.resolve(root, key);
  if (file !== root && !file.startsWith(`${root}${path.sep}`)) throw new Error("Invalid storage path.");
  return file;
}

function appendHashSuffix(relKey: string) {
  const hash = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  const lastDot = relKey.lastIndexOf(".");
  return lastDot === -1 ? `${relKey}_${hash}` : `${relKey.slice(0, lastDot)}_${hash}${relKey.slice(lastDot)}`;
}

function encodeKey(key: string) {
  return key.split("/").map(encodeURIComponent).join("/");
}

export function storageUrl(key: string) {
  return `${ENV.apiOrigin}/uploads/${encodeKey(key)}`;
}

function publicProductImageUrl(key: string) {
  const base = new URL(ENV.r2PublicBaseUrl);
  if (base.protocol !== "https:" || base.username || base.password || base.search || base.hash) {
    throw new Error("R2_PUBLIC_BASE_URL must be a clean HTTPS URL.");
  }
  return `${base.origin}${base.pathname.replace(/\/+$/, "")}/${encodeKey(key)}`;
}

let productImageR2Client: S3Client | null = null;

function getProductImageR2Client() {
  const hasAnyCredential = Boolean(ENV.r2AccessKeyId || ENV.r2SecretAccessKey);
  const hasBothCredentials = Boolean(ENV.r2AccessKeyId && ENV.r2SecretAccessKey);
  if (hasAnyCredential && !hasBothCredentials) throw new Error("Both R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY are required.");
  if (!hasBothCredentials) {
    if (ENV.isProduction) throw new Error("Durable product image storage is not configured. Set the R2 credentials on the server.");
    return null;
  }
  if (!ENV.r2S3Endpoint || !ENV.r2BucketName) throw new Error("R2_S3_ENDPOINT and R2_BUCKET_NAME are required when R2 credentials are configured.");

  if (productImageR2Client) return productImageR2Client;
  productImageR2Client = new S3Client({
    region: "auto",
    endpoint: ENV.r2S3Endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: ENV.r2AccessKeyId,
      secretAccessKey: ENV.r2SecretAccessKey,
    },
  });
  return productImageR2Client;
}

/**
 * Stores a buyer-visible product image in R2 when configured. Local fallback is
 * limited to development; production fails closed rather than returning an
 * ephemeral Render filesystem URL that would be lost on restart or deploy.
 */
export async function storagePutProductImage(relKey: string, data: Buffer | Uint8Array | string, contentType = "application/octet-stream") {
  const key = appendHashSuffix(normalizeKey(relKey));
  const body = typeof data === "string" ? Buffer.from(data) : Buffer.from(data);
  const client = getProductImageR2Client();

  if (!client) {
    const file = absolutePath(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, body);
    return { key, url: storageUrl(key) };
  }

  await client.send(new PutObjectCommand({
    Bucket: ENV.r2BucketName,
    Key: key,
    Body: body,
    ContentType: contentType,
    CacheControl: "public, max-age=31536000, immutable",
  }));

  return { key, url: publicProductImageUrl(key) };
}

/** Removes only an object previously created by the product-image pipeline. */
export async function storageDeleteProductImage(relKey: string) {
  const key = normalizeKey(relKey);
  const client = getProductImageR2Client();
  if (!client) {
    await unlink(absolutePath(key));
    return;
  }
  await client.send(new DeleteObjectCommand({ Bucket: ENV.r2BucketName, Key: key }));
}

/**
 * Converts an app upload URL into its safe relative object key. Only the
 * configured public R2 host and the legacy same-origin /uploads route qualify.
 */
export function productImageStorageKey(value: string) {
  try {
    if (/%(?:2e|2f|5c)/i.test(value)) return null;
    const appOrigin = new URL(ENV.apiOrigin);
    const publicOrigin = new URL(ENV.r2PublicBaseUrl);
    const url = new URL(value, appOrigin);
    if (url.username || url.password || url.search || url.hash) return null;

    let rawKey: string;
    if (url.origin === appOrigin.origin && url.pathname.startsWith("/uploads/")) {
      rawKey = url.pathname.slice("/uploads/".length);
    } else if (url.origin === publicOrigin.origin && url.protocol === "https:") {
      const publicPrefix = publicOrigin.pathname.replace(/\/+$/, "");
      if (publicPrefix && !url.pathname.startsWith(`${publicPrefix}/`)) return null;
      rawKey = url.pathname.slice(publicPrefix.length).replace(/^\/+/, "");
    } else {
      return null;
    }

    const key = normalizeKey(decodeURIComponent(rawKey));
    return key;
  } catch {
    return null;
  }
}

export function isProductImageUrl(value: string) {
  return productImageStorageKey(value) !== null;
}

export function isR2ProductImageUrl(value: string) {
  try {
    const publicBase = new URL(ENV.r2PublicBaseUrl);
    const url = new URL(value);
    return url.protocol === "https:"
      && url.origin === publicBase.origin
      && !url.username
      && !url.password
      && !url.search
      && !url.hash
      && productImageStorageKey(value) !== null;
  } catch {
    return false;
  }
}

export function isProductImageUrlUnderPrefix(value: string, prefix: string) {
  const key = productImageStorageKey(value);
  if (!key) return false;
  try {
    return key.startsWith(`${normalizeKey(prefix)}/`);
  } catch {
    return false;
  }
}

/** Non-product uploads intentionally remain on the existing private/local path. */
export async function storagePut(relKey: string, data: Buffer | Uint8Array | string, _contentType = "application/octet-stream") {
  const key = appendHashSuffix(normalizeKey(relKey));
  const file = absolutePath(key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, typeof data === "string" ? data : Buffer.from(data));
  return { key, url: storageUrl(key) };
}

export async function storageGet(relKey: string) {
  const key = normalizeKey(relKey);
  return { key, url: storageUrl(key) };
}

export async function storageGetSignedUrl(relKey: string) {
  const key = normalizeKey(relKey);
  await readFile(absolutePath(key));
  return storageUrl(key);
}
