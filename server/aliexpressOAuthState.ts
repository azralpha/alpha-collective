import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const STATE_TTL_MS = 10 * 60 * 1000;
const STATE_SIGNING_CONTEXT = "alpha-market:aliexpress-oauth-state:v1:";

function signState(state: string, secret: string) {
  if (!secret) throw new Error("The server session secret is not configured.");
  return createHmac("sha256", secret).update(STATE_SIGNING_CONTEXT).update(state).digest("base64url");
}

function safeMatches(expected: string, provided: unknown) {
  if (typeof provided !== "string" || !provided) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createAliExpressOAuthState(secret: string, now = Date.now()) {
  const state = `${now}.${randomBytes(32).toString("base64url")}`;
  return { state, cookieValue: `${state}.${signState(state, secret)}` };
}

export function isValidAliExpressOAuthState(cookieValue: string | undefined, queryState: unknown, secret: string, now = Date.now()) {
  if (!cookieValue || !secret) return false;
  const parts = cookieValue.split(".");
  if (parts.length !== 3 || !/^\d+$/.test(parts[0]) || !/^[A-Za-z0-9_-]{43}$/.test(parts[1]) || !/^[A-Za-z0-9_-]{43}$/.test(parts[2])) return false;
  const state = `${parts[0]}.${parts[1]}`;
  const issuedAt = Number(parts[0]);
  const fresh = Number.isFinite(issuedAt) && now - issuedAt >= 0 && now - issuedAt <= STATE_TTL_MS;
  return fresh && safeMatches(signState(state, secret), parts[2]) && safeMatches(state, queryState);
}
