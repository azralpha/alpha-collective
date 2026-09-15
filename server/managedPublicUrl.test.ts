import { describe, expect, it } from "vitest";

describe("managed public URL configuration", () => {
  it("uses the allowlisted Alpha Market managed host", () => {
    const publicAppUrl = process.env.PUBLIC_APP_URL;

    expect(publicAppUrl).toBe("https://alphashop-3pdenj2y.manus.space");
    expect(new URL(publicAppUrl).protocol).toBe("https:");
    expect(new URL(publicAppUrl).pathname).toBe("/");
  });
});

export {};
