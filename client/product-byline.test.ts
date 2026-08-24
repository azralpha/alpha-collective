import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("product seller attribution", () => {
  it("uses the requested concise By wording", () => {
    const source = readFileSync(new URL("../client/src/pages/Product.tsx", import.meta.url), "utf8");

    expect(source).toContain("By {product.vendor}");
    expect(source).not.toContain("Sold by {product.vendor}");
  });
});
