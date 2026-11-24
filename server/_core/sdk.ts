import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { extractClientIp, normalizeDeviceId } from "../referralFraud";
import { extractAdminApiKey, verifyAdminApiKey } from "./adminApiKey";
import { ENV } from "./env";

export type SessionPayload = {
  openId: string;
  name: string;
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

class AuthService {
  private getSessionSecret() {
    if (!ENV.cookieSecret) throw new Error("JWT_SECRET is not configured");
    return new TextEncoder().encode(ENV.cookieSecret);
  }

  async createSessionToken(
    openId: string,
    options: { expiresInMs?: number; name?: string } = {}
  ): Promise<string> {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    return new SignJWT({
      openId,
      name: options.name || "",
      provider: "google",
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuedAt(Math.floor(issuedAt / 1000))
      .setExpirationTime(Math.floor((issuedAt + expiresInMs) / 1000))
      .sign(this.getSessionSecret());
  }

  async verifySession(cookieValue: string | undefined | null): Promise<SessionPayload | null> {
    if (!cookieValue) return null;
    try {
      const { payload } = await jwtVerify(cookieValue, this.getSessionSecret(), { algorithms: ["HS256"] });
      const { openId, name } = payload as Record<string, unknown>;
      if (!isNonEmptyString(openId)) return null;
      return { openId, name: typeof name === "string" ? name : "" };
    } catch {
      return null;
    }
  }

  async authenticateRequest(req: Request): Promise<AuthenticatedUser> {
    const cookies = parseCookieHeader(req.headers.cookie ?? "");
    let sessionToken = cookies[COOKIE_NAME];
    if (!sessionToken) {
      const authHeader = req.headers.authorization;
      if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) sessionToken = authHeader.slice(7);
    }
    const session = await this.verifySession(sessionToken);
    if (!session) throw ForbiddenError("Invalid session cookie");

    const user = await db.getUserByOpenId(session.openId);
    if (!user) throw ForbiddenError("User not found");
    await db.upsertUser({ openId: user.openId, lastSignedIn: new Date() });

    try {
      const header = req.headers["x-alpha-device-id"];
      const deviceId = normalizeDeviceId(Array.isArray(header) ? header[0] : header);
      await db.recordUserRequestSecuritySignal({ userId: user.id, deviceId, ipAddress: extractClientIp(req) });
    } catch (error) {
      console.warn("[Auth] Security signal recording skipped", String(error));
    }
    return user;
  }

  async authenticateAdminApiKey(req: Request): Promise<AuthenticatedUser | null> {
    const candidate = extractAdminApiKey(req);
    if (!verifyAdminApiKey(candidate, ENV.adminApiKeySha256)) return null;
    if (!ENV.ownerOpenId.trim()) {
      console.error("[Admin API] A digest-matching key was rejected because OWNER_OPEN_ID is not configured.");
      return null;
    }
    const owner = await db.getUserByOpenId(ENV.ownerOpenId.trim());
    if (!owner) {
      console.error("[Admin API] A digest-matching key was rejected because OWNER_OPEN_ID did not resolve to a user.");
      return null;
    }
    if (owner.role !== "admin") {
      console.error("[Admin API] A digest-matching key was rejected because its configured owner is not an administrator.");
      return null;
    }
    console.info("[Admin API] Key authentication accepted", {
      route: (req.originalUrl || req.path || "unknown").split("?")[0],
      actorUserId: owner.id,
      ip: extractClientIp(req) ?? "unknown",
    });
    return owner;
  }

  async authenticateAdminRequest(req: Request): Promise<AuthenticatedUser> {
    try {
      const sessionUser = await this.authenticateRequest(req);
      if (sessionUser.role === "admin") return sessionUser;
    } catch {
      // Continue to the dedicated admin key check; never treat an invalid session as a valid key.
    }

    const apiUser = await this.authenticateAdminApiKey(req);
    if (apiUser) return apiUser;
    throw new Error("Administrator access required.");
  }
}

export type AuthenticatedUser = User & { taskUid?: string; isCron?: boolean };
export const sdk = new AuthService();
