import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("site-wide notification toaster", () => {
  it("uses a top-center, dismissible, five-second floating alert configuration", () => {
    const component = readFileSync(new URL("./src/components/ui/sonner.tsx", import.meta.url), "utf8");
    const styles = readFileSync(new URL("./src/index.css", import.meta.url), "utf8");

    expect(component).toContain('position="top-center"');
    expect(component).toContain("closeButton");
    expect(component).toContain("duration={5_000}");
    expect(component).toContain("AlertTriangle");
    expect(styles).toContain('[data-sonner-toaster][data-x-position="center"]');
    expect(styles).toContain('[data-sonner-toast][data-type="error"]');
    expect(styles).toContain("alpha-toast-enter");
  });
});
