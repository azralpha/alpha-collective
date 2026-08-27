import { afterEach, describe, expect, it, vi } from "vitest";
import { createNewsletterUnsubscribeToken, parseGeminiNewsletterDraft, sendStagedNewsletterCampaign, verifyNewsletterUnsubscribeToken } from "./newsletter";

const products = [{ id: "official-7", title: "New arrival", price: 12_000, description: "A practical product for everyday use.", imageUrl: "https://alphashop-3pdenj2y.manus.space/image.webp", productUrl: "https://alphashop-3pdenj2y.manus.space/product/official-7" }];
const safeHtml = `<main><h1>Fresh Drops and Hot Deals on Alpha Market</h1><img src="${products[0].imageUrl}" alt="New arrival" style="max-width:100%;height:auto;border-radius:12px" /><a href="${products[0].productUrl}">View Product</a><a href="{{ALPHA_UNSUBSCRIBE_URL}}">Unsubscribe</a></main>`;

describe("newsletter generation safeguards", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("accepts a bounded draft only when it includes every supplied product asset and one unsubscribe placeholder", () => {
    expect(parseGeminiNewsletterDraft(JSON.stringify({ subject: "New Alpha Market arrivals", htmlBody: safeHtml }), products)).toEqual({ subject: "New Alpha Market arrivals", htmlBody: safeHtml });
  });

  it("rejects unsafe email markup and drafts that omit the required opt-out path", () => {
    expect(() => parseGeminiNewsletterDraft(JSON.stringify({ subject: "New Alpha Market arrivals", htmlBody: `${safeHtml}<script>alert(1)</script>` }), products)).toThrow("unsafe newsletter HTML");
    expect(() => parseGeminiNewsletterDraft(JSON.stringify({ subject: "New Alpha Market arrivals", htmlBody: safeHtml.replace("{{ALPHA_UNSUBSCRIBE_URL}}", "#") }), products)).toThrow("required unsubscribe");
    expect(() => parseGeminiNewsletterDraft(JSON.stringify({ subject: "New Alpha Market arrivals", htmlBody: safeHtml.replace("</main>", '<img src="https://tracker.invalid/pixel.gif" /></main>') }), products)).toThrow("unapproved newsletter link or asset");
  });

  it("creates a signed, subscriber-specific unsubscribe token that cannot be altered", () => {
    vi.stubEnv("JWT_SECRET", "newsletter-test-secret");
    const token = createNewsletterUnsubscribeToken(42);
    expect(verifyNewsletterUnsubscribeToken(token)).toBe(42);
    expect(verifyNewsletterUnsubscribeToken(token.replace("42.", "43."))).toBeNull();
  });

  it("does not begin a provider delivery without the exact broadcast confirmation phrase", async () => {
    await expect(sendStagedNewsletterCampaign({ campaignId: 4, userId: 7, confirmation: "send" })).rejects.toThrow("Type SEND NEWSLETTER");
  });
});
