import { createHmac, timingSafeEqual } from "node:crypto";
import { OAuth2Client } from "google-auth-library";
import type { Express, Request, Response } from "express";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import * as db from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";

const googleClient = new OAuth2Client(ENV.googleClientId, ENV.googleClientSecret, ENV.googleRedirectUri);
const STATE_MAX_AGE_MS = 10 * 60 * 1000;

type GoogleProfile = {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

type LoginState = { returnTo: string; issuedAt: number };

function normalizeReturnTo(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return "/profile";
  return value;
}

function appRedirect(path: string, error?: string) {
  const url = new URL(path, ENV.publicAppUrl);
  if (error) url.searchParams.set("authError", error);
  return url.toString();
}

function signState(payload: string) {
  return createHmac("sha256", ENV.cookieSecret).update(payload).digest("base64url");
}

function createLoginState(returnTo: string) {
  const payload = Buffer.from(JSON.stringify({ returnTo: normalizeReturnTo(returnTo), issuedAt: Date.now() } satisfies LoginState)).toString("base64url");
  return `${payload}.${signState(payload)}`;
}

function readLoginState(value: unknown) {
  if (typeof value !== "string") return "/profile";
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return "/profile";
  const expected = signState(payload);
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return "/profile";
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as LoginState;
    if (Date.now() - parsed.issuedAt > STATE_MAX_AGE_MS) return "/profile";
    return normalizeReturnTo(parsed.returnTo);
  } catch {
    return "/profile";
  }
}

function redirectUriIsConfigured() {
  return Boolean(ENV.googleClientId && ENV.googleClientSecret && ENV.googleRedirectUri && ENV.cookieSecret);
}

async function profileFromAuthorizationCode(code: string): Promise<GoogleProfile> {
  const { tokens } = await googleClient.getToken({ code, redirect_uri: ENV.googleRedirectUri });
  if (!tokens.id_token) throw new Error("Google authorization code did not return an ID token.");
  const ticket = await googleClient.verifyIdToken({ idToken: tokens.id_token, audience: ENV.googleClientId });
  const payload = ticket.getPayload();
  if (!payload?.sub) throw new Error("Google token did not contain a subject.");
  return payload as GoogleProfile;
}

async function createSessionForGoogleProfile(profile: GoogleProfile, req: Request, res: Response) {
  if (profile.email && profile.email_verified !== true) throw new Error("Google returned an unverified email address.");

  const googleOpenId = `google:${profile.sub}`;
  const email = profile.email?.trim().toLowerCase() || null;
  let user = await db.getUserByOpenId(googleOpenId);

  if (!user && email) {
    const existing = await db.getUserByEmail(email);
    if (existing) {
      await db.linkUserToGoogle(existing.id, googleOpenId, profile.name ?? existing.name ?? null);
      user = await db.getUserByOpenId(googleOpenId);
    }
  }

  if (!user) {
    await db.upsertUser({ openId: googleOpenId, name: profile.name ?? null, email, loginMethod: "google", lastSignedIn: new Date() });
    user = await db.getUserByOpenId(googleOpenId);
  }
  if (!user) throw new Error("Could not create or load the Google user.");

  await db.upsertUser({
    openId: user.openId,
    name: profile.name ?? user.name ?? null,
    email: email ?? user.email ?? null,
    loginMethod: "google",
    lastSignedIn: new Date(),
  });

  const sessionToken = await sdk.createSessionToken(user.openId, { name: profile.name ?? user.name ?? "", expiresInMs: ONE_YEAR_MS });
  res.cookie(COOKIE_NAME, sessionToken, { ...getSessionCookieOptions(req), maxAge: ONE_YEAR_MS });
}

export function registerGoogleAuthRoute(app: Express) {
  app.get("/api/auth/google/start", (req: Request, res: Response) => {
    if (!redirectUriIsConfigured()) {
      res.status(503).send("Google authentication is not configured.");
      return;
    }

    const state = createLoginState(typeof req.query.returnTo === "string" ? req.query.returnTo : "/profile");
    const authorizationUrl = googleClient.generateAuthUrl({
      access_type: "offline",
      prompt: "select_account",
      scope: ["openid", "email", "profile"],
      include_granted_scopes: true,
      state,
    });
    res.redirect(302, authorizationUrl);
  });

  app.get("/api/auth/google/callback", async (req: Request, res: Response) => {
    const returnTo = readLoginState(req.query.state);
    if (!redirectUriIsConfigured()) {
      res.redirect(302, appRedirect("/login", "not_configured"));
      return;
    }
    if (typeof req.query.error === "string") {
      res.redirect(302, appRedirect(returnTo, req.query.error));
      return;
    }
    if (typeof req.query.code !== "string") {
      res.redirect(302, appRedirect("/login", "missing_code"));
      return;
    }

    try {
      const profile = await profileFromAuthorizationCode(req.query.code);
      await createSessionForGoogleProfile(profile, req, res);
      res.redirect(302, `${ENV.publicAppUrl}${returnTo}`);
    } catch (error) {
      console.error("[Google Auth] Callback failed", error);
      res.redirect(302, appRedirect(returnTo, "sign_in_failed"));
    }
  });

  // Kept as a compatibility endpoint for older clients; new clients use the redirect flow above.
  app.post("/api/auth/google", async (req: Request, res: Response) => {
    res.status(410).json({ error: "The Google popup flow has been retired. Use /api/auth/google/start." });
  });
}
