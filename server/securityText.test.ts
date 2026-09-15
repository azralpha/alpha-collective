import { describe, expect, it } from "vitest";
import { namesMatch, sanitizePlainText } from "./securityText";

describe("marketplace input security helpers", () => {
  it("removes HTML-like tags and control characters from plain-text content", () => {
    expect(sanitizePlainText("  <script>alert(1)</script>\u0000 Clean listing  ")).toBe("alert(1) Clean listing");
  });

  it("matches legal and bank names only after conservative normalization", () => {
    expect(namesMatch("Ada  Okafor", "ADA OKAFOR")).toBe(true);
    expect(namesMatch("Ada Okafor", "A. Okafor")).toBe(false);
  });
});
