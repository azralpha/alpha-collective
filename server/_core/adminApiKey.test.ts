import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { extractAdminApiKey, hasAdminApiKeyHeader, verifyAdminApiKey } from "./adminApiKey";

const validKey = "alpha_admin_test_key_with_more_than_32_characters_1234567890";
const validHash = createHash("sha256").update(validKey).digest("hex");

function request(headers: Record<string, string | string[] | undefined>) {
  return { headers } as never;
}

describe("admin API key verification", () => {
  it("extracts the dedicated header and bearer token", () => {
    expect(extractAdminApiKey(request({ "x-admin-api-key": validKey }))).toBe(validKey);
    expect(extractAdminApiKey(request({ authorization: `Bearer ${validKey}` }))).toBe(validKey);
    expect(extractAdminApiKey(request({ authorization: `bearer ${validKey}` }))).toBe(validKey);
    expect(extractAdminApiKey(request({ authorization: "Basic abc" }))).toBeNull();
  });

  it("validates only a candidate whose digest matches the configured SHA-256 digest", () => {
    expect(verifyAdminApiKey(validKey, validHash)).toBe(true);
    expect(verifyAdminApiKey(`${validKey}x`, validHash)).toBe(false);
    expect(verifyAdminApiKey(null, validHash)).toBe(false);
    expect(verifyAdminApiKey(validKey, undefined)).toBe(false);
    expect(verifyAdminApiKey(validKey, "not-a-sha256-digest")).toBe(false);
  });

  it("detects a supplied credential without exposing its value", () => {
    expect(hasAdminApiKeyHeader(request({ "x-admin-api-key": validKey }))).toBe(true);
    expect(hasAdminApiKeyHeader(request({ authorization: `Bearer ${validKey}` }))).toBe(true);
    expect(hasAdminApiKeyHeader(request({ authorization: "Basic abc" }))).toBe(false);
    expect(hasAdminApiKeyHeader(request({}))).toBe(false);
  });
});
