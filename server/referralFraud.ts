import { createHash } from "node:crypto";
import type { Request } from "express";
import { ENV } from "./_core/env";

const MAX_DEVICE_ID_LENGTH = 160;

export function normalizeDeviceId(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length >= 16 && normalized.length <= MAX_DEVICE_ID_LENGTH ? normalized : null;
}

export function extractClientIp(req: Pick<Request, "headers" | "ip" | "socket">) {
  const forwarded = req.headers["x-forwarded-for"];
  const firstForwarded = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0];
  const candidate = firstForwarded?.trim() || req.ip || req.socket.remoteAddress || "";
  return candidate.length ? candidate.slice(0, 128) : null;
}

export function hashSecuritySignal(value: string | null) {
  if (!value) return null;
  return createHash("sha256").update(ENV.cookieSecret).update(":" ).update(value).digest("hex");
}
