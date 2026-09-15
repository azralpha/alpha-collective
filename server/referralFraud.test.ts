import { describe, expect, it } from "vitest";
import { hashSecuritySignal, normalizeDeviceId } from "./referralFraud";

describe("referral fraud signals", () => {
  it("accepts a stable local device identifier but rejects malformed identifiers", () => {
    expect(normalizeDeviceId("a".repeat(16))).toBe("a".repeat(16));
    expect(normalizeDeviceId("short")).toBeNull();
    expect(normalizeDeviceId("a".repeat(161))).toBeNull();
  });

  it("produces a stable opaque hash rather than persisting the source identifier", () => {
    const source = "browser-local-device-identifier-12345";
    const first = hashSecuritySignal(source);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).not.toContain(source);
    expect(hashSecuritySignal(source)).toBe(first);
    expect(hashSecuritySignal("another-device-identifier-12345")).not.toBe(first);
  });
});
