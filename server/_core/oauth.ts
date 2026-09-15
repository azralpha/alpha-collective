import { COOKIE_NAME, ONE_YEAR_MS, OAUTH_STATE_COOKIE, decodeOAuthState, encodeOAuthState } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import crypto from "node:crypto";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { ENV } from "./env";
import { sdk } from "./sdk";

const PUBLIC_APP_URL = (process.env.PUBLIC_APP_URL || "https://alphamarket.name.ng").replace(/\/+$/, "");
const OAUTH_PORTAL_URL = (process.env.VITE_OAUTH_PORTAL_URL || "https://oauth.manus.im").replace(/\/+$/, "");

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

function backendOrigin(req: Request) {
  const forwardedHost = req.get("x-forwarded-host");
  const host = forwardedHost?.split(",")[0]?.trim() || req.get("host");
  return `${req.protocol}://${host}`;
}

function safeReturnTo(value: string | undefined) {
  if (!value) return PUBLIC_APP_URL;
  try {
    const target = new URL(value);
    const allowed = new URL(PUBLIC_APP_URL);
    return target.origin === allowed.origin ? target.toString() : PUBLIC_APP_URL;
  } catch {
    return PUBLIC_APP_URL;
  }
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/start", (req: Request, res: Response) => {
    const nonce = crypto.randomUUID();
    const callbackUri = `${backendOrigin(req)}/api/oauth/callback`;
    const state = encodeOAuthState({ redirectUri: callbackUri, nonce });
    const returnTo = safeReturnTo(getQueryParam(req, "returnTo"));

    res.cookie(OAUTH_STATE_COOKIE, nonce, {
      ...getSessionCookieOptions(req),
      maxAge: 10 * 60 * 1000,
    });
    const url = new URL(`${OAUTH_PORTAL_URL}/app-auth`);
    url.searchParams.set("appId", ENV.appId);
    url.searchParams.set("redirectUri", callbackUri);
    url.searchParams.set("state", state);
    url.searchParams.set("type", "signIn");
    url.searchParams.set("returnTo", returnTo);
    res.redirect(302, url.toString());
  });

  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    const { nonce } = decodeOAuthState(state);
    const expectedNonce = parseCookieHeader(req.headers.cookie ?? "")[OAUTH_STATE_COOKIE];
    if (!nonce || nonce !== expectedNonce) {
      res.status(403).json({ error: "invalid oauth state" });
      return;
    }
    res.clearCookie(OAUTH_STATE_COOKIE, { path: "/", secure: true, sameSite: "none" });

    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, PUBLIC_APP_URL);
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
