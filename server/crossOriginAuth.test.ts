import { describe, expect, it } from "vitest";
import { getSessionCookieOptions } from "./_core/cookies";

describe("cross-origin session configuration", () => {
  it("uses secure SameSite=None cookies when Render forwards HTTPS", () => {
    const options = getSessionCookieOptions({
      protocol: "http",
      headers: { "x-forwarded-proto": "https" },
    } as any);
    expect(options).toEqual({
      httpOnly: true,
      path: "/",
      sameSite: "none",
      secure: true,
    });
    expect(options).not.toHaveProperty("domain");
  });

  it("does not force a cross-host cookie domain locally", () => {
    const options = getSessionCookieOptions({ protocol: "http", headers: {} } as any);
    expect(options.sameSite).toBe("lax");
    expect(options.secure).toBe(false);
    expect(options).not.toHaveProperty("domain");
  });
});
