import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { canonicalizeDiditJson, verifyDiditV2Signature } from "./didit";

describe("Didit webhook verification", () => {
  it("canonicalizes nested objects with sorted keys and compact JSON", () => {
    expect(canonicalizeDiditJson({ z: 1, nested: { b: "José", a: true }, a: [2, null] })).toBe('{"a":[2,null],"nested":{"a":true,"b":"José"},"z":1}');
  });

  it("accepts a fresh X-Signature-V2 signature", () => {
    const payload = JSON.stringify({ status: "Approved", vendor_data: "42", session_id: "session-1" });
    const timestamp = "1730000000";
    const canonical = canonicalizeDiditJson(JSON.parse(payload));
    const signature = createHmac("sha256", "test-secret").update(canonical, "utf8").digest("hex");
    expect(verifyDiditV2Signature(payload, signature, undefined, "test-secret", timestamp, 1730000000)).toBe(true);
  });

  it("rejects stale or tampered signatures", () => {
    const payload = JSON.stringify({ status: "Approved", vendor_data: "42", session_id: "session-1" });
    const signature = createHmac("sha256", "test-secret").update(canonicalizeDiditJson(JSON.parse(payload)), "utf8").digest("hex");
    expect(verifyDiditV2Signature(payload, signature, undefined, "test-secret", "1729999000", 1730000000)).toBe(false);
    expect(verifyDiditV2Signature(payload.replace("Approved", "Declined"), signature, undefined, "test-secret", "1730000000", 1730000000)).toBe(false);
  });
});
