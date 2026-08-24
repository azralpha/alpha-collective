import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("global Tawk.to support widget", () => {
  it("loads the supplied widget URL asynchronously from the global document", () => {
    const html = readFileSync(new URL("../client/index.html", import.meta.url), "utf8");

    expect(html).toContain("https://embed.tawk.to/6a8c6d7d101bcd344357ec97/1k0q8nd4i");
    expect(html).toContain("s1.async = true");
    expect(html).toContain("s1.setAttribute(\"crossorigin\", \"*\")");
  });
});
