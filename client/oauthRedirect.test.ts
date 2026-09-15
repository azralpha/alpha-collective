import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./src/const.ts", import.meta.url), "utf8");

describe("Manus OAuth redirect handling", () => {
  it("hands custom-domain visitors off to the managed host before creating OAuth state", () => {
    expect(source).toContain('import.meta.env.VITE_AUTH_ORIGIN');
    expect(source).toContain('handoffUrl.searchParams.set("oauthHandoff", "1");');
    expect(source).toContain("const redirectUri = `${currentOrigin}/api/oauth/callback`;");
  });

  it("includes the configured app identifier and callback in the authorization request", () => {
    expect(source).toContain("url.searchParams.set(\"appId\", appId);");
    expect(source).toContain("url.searchParams.set(\"redirectUri\", redirectUri);");
    expect(source).toContain("url.searchParams.set(\"state\", state);");
  });
});
