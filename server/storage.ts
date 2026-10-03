import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { ENV } from "./_core/env";

function normalizeKey(relKey: string) {
  const key = relKey.replace(/^\/+/, "");
  if (!key || key.split("/").some(part => part === ".." || part === ".")) throw new Error("Invalid storage key.");
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

export function storageUrl(key: string) {
  return `${ENV.apiOrigin}/uploads/${key.split("/").map(encodeURIComponent).join("/")}`;
}

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
