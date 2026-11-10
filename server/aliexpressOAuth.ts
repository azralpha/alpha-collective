import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { Express, Request, Response } from "express";
import { parse as parseCookieHeader } from "cookie";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";
import { createExpressRateLimit } from "./requestRateLimit";
import { getSupplierOAuthCredential, saveSupplierOAuthCredential } from "./db";
import { aliExpressAppCredentialsConfigured, callAliExpressSystemApi } from "./aliexpressOpenPlatform";
import { createAliExpressOAuthState, isValidAliExpressOAuthState } from "./aliexpressOAuthState";

const PROVIDER = "aliexpress";
const STATE_COOKIE = new URL(ENV.publicAppUrl).protocol === "https:" ? "__Host-alpha_aliexpress_oauth_state" : "alpha_aliexpress_oauth_state";
const CALLBACK_PATH = "/api/admin/suppliers/aliexpress/callback";
const STATE_TTL_MS = 10 * 60 * 1000;
const TOKEN_REFRESH_SKEW_MS = 90_000;
let refreshInFlight: Promise<string> | null = null;

type AliExpressTokenResponse = Record<string, unknown> & {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number | string;
  refresh_expires_in?: number | string;
  expire_time?: number | string;
  refresh_token_valid_time?: number | string;
  account_id?: string | number;
  seller_id?: string | number;
  user_id?: string | number;
};

function tokenEncryptionKey() {
  if (!ENV.cookieSecret) throw new Error("The server session secret is not configured.");
  return createHash("sha256").update("alpha-market:ali-express-oauth:v1:").update(ENV.cookieSecret).digest();
}

export function encryptAliExpressToken(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", tokenEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return `v1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${ciphertext.toString("base64url")}`;
}

export function decryptAliExpressToken(encrypted: string) {
  const [version, ivValue, tagValue, ciphertextValue] = encrypted.split(".");
  if (version !== "v1" || !ivValue || !tagValue || !ciphertextValue) throw new Error("Stored AliExpress credentials could not be decrypted.");
  try {
    const decipher = createDecipheriv("aes-256-gcm", tokenEncryptionKey(), Buffer.from(ivValue, "base64url"));
    decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(ciphertextValue, "base64url")), decipher.final()]).toString("utf8");
  } catch {
    throw new Error("Stored AliExpress credentials could not be decrypted. Reconnect the supplier account.");
  }
}

function requiredToken(payload: AliExpressTokenResponse) {
  const accessToken = typeof payload.access_token === "string" ? payload.access_token.trim() : "";
  const refreshToken = typeof payload.refresh_token === "string" ? payload.refresh_token.trim() : "";
  if (!accessToken || !refreshToken) throw new Error("AliExpress did not return both access and refresh tokens. Confirm seller authorization and app permissions.");
  return { accessToken, refreshToken };
}

function tokenExpiry(expireTime: unknown, secondsValue: unknown, field: string) {
  const epoch = Number(expireTime);
  if (Number.isFinite(epoch) && epoch > 1_000_000_000_000) return new Date(epoch);
  if (Number.isFinite(epoch) && epoch > 1_000_000_000) return new Date(epoch * 1000);
  const seconds = Number(secondsValue);
  if (Number.isFinite(seconds) && seconds > 0) return new Date(Date.now() + seconds * 1000);
  throw new Error(`AliExpress did not return a usable ${field} expiry.`);
}

function readTokenPayload(payload: AliExpressTokenResponse) {
  const response = (payload.aliexpress_system_oauth_token_response as AliExpressTokenResponse | undefined) ?? payload;
  const tokens = requiredToken(response);
  return {
    ...tokens,
    accessTokenExpiresAt: tokenExpiry(response.expire_time, response.expires_in, "access token"),
    refreshTokenExpiresAt: tokenExpiry(response.refresh_token_valid_time, response.refresh_expires_in, "refresh token"),
    accountId: String(response.account_id ?? response.seller_id ?? response.user_id ?? "").slice(0, 180) || null,
  };
}

export async function exchangeAliExpressAuthorizationCode(code: string) {
  const response = await callAliExpressSystemApi<AliExpressTokenResponse>("/auth/token/create", { code });
  return readTokenPayload(response);
}

async function refreshAliExpressAccessToken() {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const stored = await getSupplierOAuthCredential(PROVIDER);
      if (!stored) throw new Error("Connect the AliExpress account in Dropship Integrations before importing products.");
      if (stored.refreshTokenExpiresAt && stored.refreshTokenExpiresAt.getTime() <= Date.now()) throw new Error("The AliExpress authorization expired. Reconnect the account in Dropship Integrations.");
      const refreshToken = decryptAliExpressToken(stored.encryptedRefreshToken);
      const response = await callAliExpressSystemApi<AliExpressTokenResponse>("/auth/token/refresh", { refresh_token: refreshToken });
      const parsed = readTokenPayload({ ...response, refresh_token: response.refresh_token ?? refreshToken });
      await saveSupplierOAuthCredential({
        provider: PROVIDER,
        encryptedAccessToken: encryptAliExpressToken(parsed.accessToken),
        encryptedRefreshToken: encryptAliExpressToken(parsed.refreshToken),
        accessTokenExpiresAt: parsed.accessTokenExpiresAt,
        refreshTokenExpiresAt: parsed.refreshTokenExpiresAt,
        accountId: parsed.accountId ?? stored.accountId,
      });
      return parsed.accessToken;
    })().finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

export async function getAliExpressAccessToken() {
  const stored = await getSupplierOAuthCredential(PROVIDER);
  if (!stored) throw new Error("Connect the AliExpress account in Dropship Integrations before importing products.");
  if (stored.accessTokenExpiresAt.getTime() > Date.now() + TOKEN_REFRESH_SKEW_MS) return decryptAliExpressToken(stored.encryptedAccessToken);
  return refreshAliExpressAccessToken();
}

export async function getAliExpressConnectionStatus() {
  let stored = null;
  try { stored = await getSupplierOAuthCredential(PROVIDER); }
  catch { return { appCredentialsConfigured: aliExpressAppCredentialsConfigured(), connected: false, callbackUrl: new URL(CALLBACK_PATH, ENV.publicAppUrl).toString(), accessTokenExpiresAt: null }; }
  return {
    appCredentialsConfigured: aliExpressAppCredentialsConfigured(),
    connected: Boolean(stored),
    callbackUrl: new URL(CALLBACK_PATH, ENV.publicAppUrl).toString(),
    accessTokenExpiresAt: stored?.accessTokenExpiresAt ?? null,
  };
}

function adminStatusUrl(result: "connected" | "cancelled" | "failed", reason?: string) {
  const url = new URL("/admin/dropship-integrations", ENV.publicAppUrl);
  url.searchParams.set("aliexpress", result);
  if (result === "failed" && reason) url.searchParams.set("aliexpress_reason", reason.replace(/[^a-zA-Z0-9_.:-]/g, "").slice(0, 120));
  return url.toString();
}

async function requireAdmin(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (user.role !== "admin") {
      res.status(403).set("Cache-Control", "no-store").send("Administrator access required.");
      return false;
    }
    return true;
  } catch {
    res.status(401).set("Cache-Control", "no-store").send("Administrator sign-in is required.");
    return false;
  }
}

export function registerAliExpressOAuthRoutes(app: Express) {
  app.get("/api/admin/suppliers/aliexpress/connect", createExpressRateLimit({ scope: "aliexpress-oauth-connect", limit: 8, windowMs: 60_000 }), async (req: Request, res: Response) => {
    if (!(await requireAdmin(req, res))) return;
    if (!aliExpressAppCredentialsConfigured()) return res.status(503).set("Cache-Control", "no-store").send("AliExpress App Key and App Secret are not configured on the server.");
    const oauthState = createAliExpressOAuthState(ENV.cookieSecret);
    const secure = new URL(ENV.publicAppUrl).protocol === "https:";
    res.cookie(STATE_COOKIE, oauthState.cookieValue, { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: STATE_TTL_MS });
    const authorizationUrl = new URL("/oauth/authorize", "https://api-sg.aliexpress.com");
    authorizationUrl.searchParams.set("response_type", "code");
    authorizationUrl.searchParams.set("force_auth", "true");
    authorizationUrl.searchParams.set("redirect_uri", new URL(CALLBACK_PATH, ENV.publicAppUrl).toString());
    authorizationUrl.searchParams.set("client_id", process.env.ALIEXPRESS_APP_KEY!.trim());
    authorizationUrl.searchParams.set("state", oauthState.state);
    res.redirect(302, authorizationUrl.toString());
  });

  app.get(CALLBACK_PATH, createExpressRateLimit({ scope: "aliexpress-oauth-callback", limit: 20, windowMs: 60_000 }), async (req: Request, res: Response) => {
    const clearStateCookie = () => res.clearCookie(STATE_COOKIE, { httpOnly: true, secure: new URL(ENV.publicAppUrl).protocol === "https:", sameSite: "lax", path: "/" });
    // The OAuth provider returns via a cross-site navigation, where application auth cookies
    // may be absent. The one-time, browser-bound state cookie proves the flow was initiated by
    // the authenticated admin connect endpoint; do not send a 401 and then mutate its response.
    const stateCookie = parseCookieHeader(req.headers.cookie ?? "")[STATE_COOKIE];
    if (!isValidAliExpressOAuthState(stateCookie, req.query.state, ENV.cookieSecret)) {
      clearStateCookie();
      console.warn("[AliExpress OAuth] Callback rejected: missing, mismatched, or expired state.");
      return res.redirect(302, adminStatusUrl("failed", "invalid_or_expired_state"));
    }
    clearStateCookie();
    if (typeof req.query.error === "string") return res.redirect(302, adminStatusUrl("cancelled"));
    if (typeof req.query.code !== "string" || req.query.code.length > 4096) {
      console.warn("[AliExpress OAuth] Callback rejected: authorization code missing or invalid.");
      return res.redirect(302, adminStatusUrl("failed", "authorization_code_missing"));
    }
    let callbackStage = "token_exchange";
    try {
      const tokens = await exchangeAliExpressAuthorizationCode(req.query.code);
      callbackStage = "token_storage";
      await saveSupplierOAuthCredential({
        provider: PROVIDER,
        encryptedAccessToken: encryptAliExpressToken(tokens.accessToken),
        encryptedRefreshToken: encryptAliExpressToken(tokens.refreshToken),
        accessTokenExpiresAt: tokens.accessTokenExpiresAt,
        refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
        accountId: tokens.accountId,
      });
      return res.redirect(302, adminStatusUrl("connected"));
    } catch (error) {
      const apiError = error instanceof Error && "providerCode" in error ? error as Error & { providerCode?: string | null; requestId?: string | null } : null;
      const providerCode = apiError?.providerCode?.replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 80) || null;
      const requestId = apiError?.requestId?.replace(/[^a-zA-Z0-9_.-]/g, "").slice(0, 100) || null;
      console.error("[AliExpress OAuth] Callback failed.", { stage: callbackStage, providerCode, requestId, errorType: error instanceof Error ? error.name : "unknown" });
      return res.redirect(302, adminStatusUrl("failed", providerCode ? `${callbackStage}:${providerCode}` : `${callbackStage}:failed`));
    }
  });
}
