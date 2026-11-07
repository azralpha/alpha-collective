import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./src/const.ts", import.meta.url), "utf8");
const buttonSource = readFileSync(new URL("./src/components/GoogleSignInButton.tsx", import.meta.url), "utf8");

describe("Google login redirect handling", () => {
  it("uses same-origin API calls by default and allows an explicit API origin override", () => {
    expect(source).toContain('import.meta.env.VITE_API_ORIGIN ?? ""');
    expect(source).not.toContain('"https://alpha-giddy-main.onrender.com"');
    expect(source).toContain('apiUrl = (path: string)');
  });

  it("keeps the browser return location for the Google login page", () => {
    expect(buttonSource).toContain('apiUrl("/api/auth/google/start")');
    expect(buttonSource).toContain("window.location.assign");
    expect(buttonSource).toContain("encodeURIComponent(destination)");
  });
});
