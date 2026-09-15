import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("native Alpha AI Support shell", () => {
  it("replaces Tawk with the reusable chat UI and clear privacy guidance", () => {
    const shell = readFileSync(new URL("../client/src/components/MarketplaceShell.tsx", import.meta.url), "utf8");
    const support = readFileSync(new URL("../client/src/components/AlphaAiSupport.tsx", import.meta.url), "utf8");
    const html = readFileSync(new URL("../client/index.html", import.meta.url), "utf8");
    expect(shell).toContain("AlphaAiSupport");
    expect(support).toContain("AIChatBox");
    expect(support).toContain("Do not share card details, PINs, passwords, bank details, or IDs.");
    expect(html).not.toMatch(/tawk/i);
  });
});
