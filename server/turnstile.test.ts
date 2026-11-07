import { describe, expect, it, vi } from "vitest";
import { verifyTurnstileToken, type TurnstileVerifierConfig } from "./turnstile";

const config: TurnstileVerifierConfig = {
  siteKey: "public-site-key",
  secretKey: "server-only-secret",
  expectedHostname: "alphamarket.name.ng",
};

function mockFetch(payload: unknown, status = 200) {
  return vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
    new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } }),
  ) as unknown as typeof fetch;
}

describe("Cloudflare Turnstile verification", () => {
  it("posts the token, secret, action context, and remote IP to Siteverify", async () => {
    const fetcher = mockFetch({ success: true, hostname: "alphamarket.name.ng", action: "google_signin" });
    const result = await verifyTurnstileToken("challenge-token", "google_signin", "203.0.113.4", config, fetcher);

    expect(result).toBe(true);
    const [, init] = vi.mocked(fetcher).mock.calls[0];
    const form = new URLSearchParams(String(init?.body));
    expect(form.get("response")).toBe("challenge-token");
    expect(form.get("secret")).toBe(config.secretKey);
    expect(form.get("remoteip")).toBe("203.0.113.4");
    expect(vi.mocked(fetcher).mock.calls[0][0]).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
  });

  it("rejects missing tokens and incomplete server configuration without calling Cloudflare", async () => {
    const fetcher = mockFetch({ success: true, hostname: "alphamarket.name.ng", action: "google_signin" });
    expect(await verifyTurnstileToken("", "google_signin", undefined, config, fetcher)).toBe(false);
    expect(await verifyTurnstileToken("token", "google_signin", undefined, { ...config, secretKey: "" }, fetcher)).toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    [{ success: false, hostname: "alphamarket.name.ng", action: "google_signin" }, "google_signin"],
    [{ success: true, hostname: "attacker.example", action: "google_signin" }, "google_signin"],
    [{ success: true, hostname: "alphamarket.name.ng", action: "newsletter_signup" }, "google_signin"],
  ])("rejects failed, wrong-host, or wrong-action responses", async (payload, action) => {
    expect(await verifyTurnstileToken("challenge-token", action, undefined, config, mockFetch(payload))).toBe(false);
  });

  it("fails closed on provider errors, non-success HTTP status, and network failures", async () => {
    expect(await verifyTurnstileToken("challenge-token", "google_signin", undefined, config, mockFetch({ success: true }, 503))).toBe(false);
    const failingFetch = vi.fn(async () => { throw new Error("network unavailable"); }) as unknown as typeof fetch;
    expect(await verifyTurnstileToken("challenge-token", "google_signin", undefined, config, failingFetch)).toBe(false);
  });
});
