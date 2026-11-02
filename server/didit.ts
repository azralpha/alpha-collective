import { createHmac, timingSafeEqual } from "node:crypto";
import type { Express, Request, Response } from "express";
import express from "express";
import { and, eq } from "drizzle-orm";
import { kycProfiles } from "../drizzle/schema";
import { getDb } from "./db";

const DIDIT_SESSION_URL = "https://verification.didit.me/v3/session/";
const MAX_WEBHOOK_AGE_SECONDS = 300;

function requireDb() {
  return getDb().then(db => {
    if (!db) throw new Error("The marketplace database is not available.");
    return db;
  });
}

function requiredEnv(name: "DIDIT_API_KEY" | "DIDIT_WORKFLOW_ID") {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

function diditCallbackUrl() {
  const origin = (process.env.PUBLIC_APP_URL ?? process.env.APP_BASE_URL ?? "").trim().replace(/\/$/, "");
  if (!origin) throw new Error("PUBLIC_APP_URL is not configured.");
  return `${origin}/profile?verification=didit`;
}

export type DiditSessionResponse = {
  session_id: string;
  url: string;
  status?: string;
  vendor_data?: string | null;
  workflow_id?: string;
};

export async function createDiditSession(input: { userId: number; email?: string | null; legalName?: string | null }) {
  const db = await requireDb();
  const apiKey = requiredEnv("DIDIT_API_KEY");
  const workflowId = requiredEnv("DIDIT_WORKFLOW_ID");
  const callback = diditCallbackUrl();
  const vendorData = String(input.userId);
  const response = await fetch(DIDIT_SESSION_URL, {
    method: "POST",
    headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      workflow_id: workflowId,
      vendor_data: vendorData,
      callback,
      callback_method: "both",
      metadata: { provider: "didit", alpha_market_user_id: input.userId },
      ...(input.email ? { contact_details: { email: input.email, send_notification_emails: false } } : {}),
      ...(input.legalName ? { expected_details: { full_name: input.legalName } } : {}),
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const payload = await response.json().catch(() => null) as Partial<DiditSessionResponse> & { detail?: string; message?: string } | null;
  if (!response.ok || !payload?.session_id || !payload.url) {
    console.error("[Didit] session creation failed", { status: response.status, message: payload?.detail ?? payload?.message });
    throw new Error("Identity verification could not be started. Please try again shortly.");
  }
  await db.insert(kycProfiles).values({ userId: input.userId, status: "identity_pending", diditSessionId: payload.session_id, diditStatus: payload.status ?? "Not Started", diditUpdatedAt: new Date(), failureReason: null }).onDuplicateKeyUpdate({ set: { status: "identity_pending", diditSessionId: payload.session_id, diditStatus: payload.status ?? "Not Started", diditUpdatedAt: new Date(), failureReason: null } });
  return { sessionId: payload.session_id, url: payload.url, status: payload.status ?? "Not Started" };
}

export function canonicalizeDiditJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalizeDiditJson).join(",")}]`;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonicalizeDiditJson(record[key])}`).join(",")}}`;
  }
  throw new Error("Unsupported webhook JSON value.");
}

function secureEquals(expected: string, received: string | undefined) {
  if (!received) return false;
  const left = Buffer.from(expected, "utf8");
  const right = Buffer.from(received, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}

export function verifyDiditV2Signature(rawBody: string, signature: string | undefined, previousSignature: string | undefined, secret: string, timestamp: string | undefined, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!signature || !timestamp || !/^\d+$/.test(timestamp)) return false;
  if (Math.abs(nowSeconds - Number(timestamp)) > MAX_WEBHOOK_AGE_SECONDS) return false;
  let parsed: unknown;
  try { parsed = JSON.parse(rawBody); } catch { return false; }
  const expected = createHmac("sha256", secret).update(canonicalizeDiditJson(parsed), "utf8").digest("hex");
  return secureEquals(expected, signature) || secureEquals(expected, previousSignature);
}

function normalizedStatus(status: unknown) {
  return typeof status === "string" ? status.trim() : "";
}

export async function processDiditWebhook(payload: Record<string, unknown>) {
  const sessionId = typeof payload.session_id === "string" ? payload.session_id : "";
  const vendorData = typeof payload.vendor_data === "string" ? payload.vendor_data : "";
  const status = normalizedStatus(payload.status);
  const userId = Number(vendorData);
  if (!sessionId || !Number.isInteger(userId) || userId <= 0 || !status) return { processed: false, reason: "invalid_payload" as const };
  const statusMap: Record<string, "identity_pending" | "identity_verified" | "rejected"> = {
    Approved: "identity_verified",
    Declined: "rejected",
    "In Review": "identity_pending",
    "In Progress": "identity_pending",
    "Not Started": "identity_pending",
    Resubmitted: "identity_pending",
    Abandoned: "rejected",
    Expired: "rejected",
    "Kyc Expired": "rejected",
    "Awaiting User": "identity_pending",
  };
  const mapped = statusMap[status];
  if (!mapped) return { processed: false, reason: "ignored_status" as const };
  const db = await requireDb();
  const result = await db.update(kycProfiles).set({ status: mapped, diditStatus: status, diditUpdatedAt: new Date(), failureReason: mapped === "rejected" ? `Didit status: ${status}` : null, ...(mapped === "identity_verified" ? { identityVerifiedAt: new Date() } : {}) }).where(and(eq(kycProfiles.userId, userId), eq(kycProfiles.diditSessionId, sessionId)));
  return { processed: result[0].affectedRows > 0, status };
}

export function registerDiditWebhook(app: Express) {
  app.post("/api/webhooks/didit", express.raw({ type: "application/json", limit: "256kb" }), async (req: Request, res: Response) => {
    const secret = process.env.DIDIT_WEBHOOK_SECRET?.trim();
    const raw = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : "";
    if (!secret || !raw || !verifyDiditV2Signature(raw, req.header("x-signature-v2") ?? undefined, req.header("x-signature-v2-previous") ?? undefined, secret, req.header("x-timestamp") ?? undefined)) {
      res.status(401).json({ received: false });
      return;
    }
    try {
      const result = await processDiditWebhook(JSON.parse(raw) as Record<string, unknown>);
      res.status(200).json({ received: true, ...result });
    } catch (error) {
      console.error("[Didit] webhook processing failed", error instanceof Error ? error.message : error);
      res.status(500).json({ received: false });
    }
  });
}
