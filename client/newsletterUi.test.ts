import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("newsletter subscription and staging interface", () => {
  it("renders a footer consent form and a separate administrator draft, preview, and explicit-send workflow", () => {
    const subscribe = readFileSync(resolve(process.cwd(), "client/src/components/NewsletterSubscribe.tsx"), "utf8");
    const admin = readFileSync(resolve(process.cwd(), "client/src/pages/AdminNewsletter.tsx"), "utf8");
    expect(subscribe).toContain("Join the Alpha VIP list");
    expect(subscribe).toContain('fetch("/api/marketing/subscribe"');
    expect(subscribe).toContain("Unsubscribe anytime");
    expect(admin).toContain('action: "draft"');
    expect(admin).toContain("Newsletter draft staged");
    expect(admin).toContain("sandbox=\"\"");
    expect(admin).toContain("SEND NEWSLETTER");
    expect(admin).toContain('action: "send"');
  });
});
