import { describe, expect, it } from "vitest";

describe("managed Alpha Market brand configuration", () => {
  it("uses Alpha Market as the configured public application title", () => {
    expect(process.env.VITE_APP_TITLE).toBe("Alpha Market");
  });
});
