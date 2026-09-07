import { describe, expect, it } from "vitest";

describe("temporary managed OAuth origin", () => {
  it("is configured as the HTTPS Alpha Market managed host", () => {
    const authOrigin = process.env.VITE_AUTH_ORIGIN;

    expect(authOrigin).toBe("https://alphashop-3pdenj2y.manus.space");
    expect(new URL(authOrigin).protocol).toBe("https:");
    expect(new URL(authOrigin).pathname).toBe("/");
  });
});

export {};
