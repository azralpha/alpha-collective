import type { Request } from "express";
import { ENV } from "./_core/env";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const VERIFY_TIMEOUT_MS = 5_000;

type SiteverifyPayload = {
  success?: unknown;
  hostname?: unknown;
  action?: unknown;
};

export type TurnstileVerifierConfig = {
  siteKey: string;
  secretKey: string;
  expectedHostname: string;
};

function publicHostname() {
  try {
    const url = new URL(ENV.publicAppUrl);
    return url.protocol === "https:" ? url.hostname.toLowerCase() : "";
  } catch {
    return "";
  }
}

export function isTurnstileConfigured() {
  return Boolean(ENV.turnstileSiteKey && ENV.turnstileSecretKey && publicHostname());
}

export async function verifyTurnstileToken(
  rawToken: unknown,
  action: string,
  remoteIp: string | undefined,
  config: TurnstileVerifierConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  if (
    typeof rawToken !== "string" ||
    rawToken.trim().length === 0 ||
    rawToken.length > 4096 ||
    !action ||
    !config.siteKey ||
    !config.secretKey ||
    !config.expectedHostname
  ) {
    return false;
  }

  const form = new URLSearchParams({ secret: config.secretKey, response: rawToken.trim() });
  if (remoteIp) form.set("remoteip", remoteIp);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), VERIFY_TIMEOUT_MS);

  try {
    const response = await fetchImpl(SITEVERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      signal: controller.signal,
    });
    if (!response.ok) return false;

    const payload: unknown = await response.json();
    if (typeof payload !== "object" || payload === null) return false;
    const result = payload as SiteverifyPayload;

    return (
      result.success === true &&
      typeof result.hostname === "string" &&
      result.hostname.toLowerCase() === config.expectedHostname.toLowerCase() &&
      result.action === action
    );
  } catch {
    // Fail closed. Do not log or return the response token, secret, or provider error details.
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

export function verifyRequestTurnstile(req: Request, token: unknown, action: string) {
  return verifyTurnstileToken(
    token,
    action,
    req.ip,
    {
      siteKey: ENV.turnstileSiteKey,
      secretKey: ENV.turnstileSecretKey,
      expectedHostname: publicHostname(),
    },
  );
}
