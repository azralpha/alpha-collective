import { createHash, timingSafeEqual } from "node:crypto";
import type { Request } from "express";

const MAX_KEY_LENGTH = 512;

export function extractAdminApiKey(req: Pick<Request, "headers">) {
  const explicit = req.headers["x-admin-api-key"];
  const headerValue = Array.isArray(explicit) ? explicit[0] : explicit;
  if (typeof headerValue === "string" && headerValue.length > 0 && headerValue.length <= MAX_KEY_LENGTH) return headerValue;

  const authorization = req.headers.authorization;
  if (typeof authorization !== "string" || authorization.length > MAX_KEY_LENGTH + 7) return null;
  const match = authorization.match(/^Bearer ([^\s]+)$/i);
  return match?.[1] ?? null;
}

export function hasAdminApiKeyHeader(req: Pick<Request, "headers">) {
  const explicit = req.headers["x-admin-api-key"];
  if ((typeof explicit === "string" && explicit.length > 0) || (Array.isArray(explicit) && explicit.some(Boolean))) return true;
  return typeof req.headers.authorization === "string" && /^Bearer\s+\S+/i.test(req.headers.authorization);
}

export function verifyAdminApiKey(candidate: string | null | undefined, configuredSha256: string | undefined) {
  if (!candidate || candidate.length > MAX_KEY_LENGTH || !configuredSha256 || !/^[a-f0-9]{64}$/i.test(configuredSha256)) return false;
  const expected = Buffer.from(configuredSha256, "hex");
  const actual = createHash("sha256").update(candidate, "utf8").digest();
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
