import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./src/const.ts", import.meta.url), "utf8");

describe("Manus OAuth redirect handling", () => {
  it("uses the active browser origin for the callback rather than a hard-coded host", () => {
    expect(source).toContain("const redirectUri = `${window.location.origin}/api/oauth/callback`;");
    expect(source).not.toContain("alphashop-3pdenj2y.manus.space");
    expect(source).not.toContain("alphacorp.name.ng");
  });

  it("includes the configured app identifier and callback in the authorization request", () => {
    expect(source).toContain("url.searchParams.set(\"appId\", appId);");
    expect(source).toContain("url.searchParams.set(\"redirectUri\", redirectUri);");
    expect(source).toContain("url.searchParams.set(\"state\", state);");
  });
});
