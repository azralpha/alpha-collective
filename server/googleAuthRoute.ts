import { OAuth2Client } from "google-auth-library";
import type { Express, Request, Response } from "express";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import * as db from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";

const googleClient = new OAuth2Client(ENV.googleClientId, ENV.googleClientSecret, ENV.googleRedirectUri);

type GoogleProfile = {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

async function verifyGoogleCredential(input: { credential?: string; code?: string }): Promise<GoogleProfile> {
  if (input.credential) {
    const ticket = await googleClient.verifyIdToken({ idToken: input.credential, audience: ENV.googleClientId });
    const payload = ticket.getPayload();
    if (!payload?.sub) throw new Error("Google token did not contain a subject.");
    return payload as GoogleProfile;
  }

  if (input.code) {
    const { tokens } = await googleClient.getToken({ code: input.code, redirect_uri: ENV.googleRedirectUri });
    if (!tokens.id_token) throw new Error("Google authorization code did not return an ID token.");
    const ticket = await googleClient.verifyIdToken({ idToken: tokens.id_token, audience: ENV.googleClientId });
    const payload = ticket.getPayload();
    if (!payload?.sub) throw new Error("Google token did not contain a subject.");
    return payload as GoogleProfile;
  }

  throw new Error("A Google credential or authorization code is required.");
}

export function registerGoogleAuthRoute(app: Express) {
  app.get("/api/auth/google/config", (_req: Request, res: Response) => {
    res.status(200).json({ clientId: ENV.googleClientId || null });
  });

  app.post("/api/auth/google", async (req: Request, res: Response) => {
    try {
      if (!ENV.googleClientId || !ENV.cookieSecret) {
        res.status(503).json({ error: "Google authentication is not configured." });
        return;
      }

      const profile = await verifyGoogleCredential({ credential: req.body?.credential, code: req.body?.code });
      if (profile.email && profile.email_verified !== true) {
        res.status(403).json({ error: "Google returned an unverified email address." });
        return;
      }

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
        await db.upsertUser({
          openId: googleOpenId,
          name: profile.name ?? null,
          email,
          loginMethod: "google",
          lastSignedIn: new Date(),
        });
        user = await db.getUserByOpenId(googleOpenId);
      }

      if (!user) throw new Error("Could not create or load the Google user.");
      await db.upsertUser({ openId: user.openId, name: profile.name ?? user.name ?? null, email: email ?? user.email ?? null, loginMethod: "google", lastSignedIn: new Date() });

      const sessionToken = await sdk.createSessionToken(user.openId, { name: profile.name ?? user.name ?? "", expiresInMs: ONE_YEAR_MS });
      res.cookie(COOKIE_NAME, sessionToken, { ...getSessionCookieOptions(req), maxAge: ONE_YEAR_MS });
      res.status(200).json({ success: true, user: { id: user.id, name: profile.name ?? user.name, email: email ?? user.email, loginMethod: "google" } });
    } catch (error) {
      console.error("[Google Auth] Sign-in failed", error);
      res.status(401).json({ error: "Google sign-in could not be verified." });
    }
  });
}
