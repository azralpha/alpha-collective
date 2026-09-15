import { describe, expect, it, afterEach } from "vitest";
import { isAllowedCorsOrigin } from "./_core/cors";

afterEach(() => {
  delete process.env.CORS_ALLOWED_ORIGINS;
});

describe("cross-origin authentication CORS policy", () => {
  it("allows the production Cloudflare frontend by default", () => {
    expect(isAllowedCorsOrigin("https://alphamarket.name.ng")).toBe(true);
    expect(isAllowedCorsOrigin("https://evil.example")).toBe(false);
  });

  it("supports an explicit comma-separated deployment allowlist", () => {
    process.env.CORS_ALLOWED_ORIGINS = "https://alphamarket.name.ng, https://preview.example";
    expect(isAllowedCorsOrigin("https://preview.example")).toBe(true);
    expect(isAllowedCorsOrigin("https://evil.example")).toBe(false);
  });
});
