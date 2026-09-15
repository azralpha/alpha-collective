import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("homepage shopping call-to-action", () => {
  it("uses the approved Naija Good Finds wording", () => {
    const source = readFileSync(new URL("../client/src/pages/Home.tsx", import.meta.url), "utf8");

    expect(source).toContain("Shop Naija’s Good Finds");
    expect(source).not.toContain("Shop today’s deals");
  });
});
