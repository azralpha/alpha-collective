import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./src/const.ts", import.meta.url), "utf8");

describe("Manus OAuth redirect handling", () => {
  it("starts OAuth on the configured Render API origin", () => {
    expect(source).toContain("import.meta.env.VITE_API_ORIGIN");
    expect(source).toContain('apiUrl("/api/oauth/start")');
    expect(source).toContain('url.searchParams.set("returnTo", returnTo);');
  });

  it("keeps the browser return location with the OAuth start request", () => {
    expect(source).toContain("window.location.pathname");
    expect(source).toContain("window.location.search");
  });
});
