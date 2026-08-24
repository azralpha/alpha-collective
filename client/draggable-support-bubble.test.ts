import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("draggable customer support bubble", () => {
  it("uses dedicated mouse and touch drag handling and opens the Tawk chat API", () => {
    const source = readFileSync(new URL("../client/src/components/DraggableSupportBubble.tsx", import.meta.url), "utf8");

    expect(source).toContain('window.addEventListener("mousemove"');
    expect(source).toContain('window.addEventListener("mouseup"');
    expect(source).toContain('window.addEventListener("touchmove"');
    expect(source).toContain('window.addEventListener("touchend"');
    expect(source).toContain("onMouseDown");
    expect(source).toContain("onTouchStart");
    expect(source).toContain("api?.hideWidget");
    expect(source).toContain("api?.maximize");
    expect(source).toContain("localStorage.setItem(STORAGE_KEY");
  });
});
