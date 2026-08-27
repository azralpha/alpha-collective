import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { Resend } from "resend";
import { z } from "zod";
import {
  claimNewsletterCampaignForSend,
  countActiveNewsletterSubscribers,
  createNewsletterCampaign,
  createNewsletterDelivery,
  finishNewsletterCampaign,
  getNewsletterCampaign,
  listActiveNewsletterSubscribers,
  listNewsletterFeaturedProducts,
  markNewsletterSubscriberEmailed,
  updateNewsletterDelivery,
  upsertNewsletterSubscriber,
  type NewsletterProductSnapshot,
} from "./db";
import { absoluteHttpsUrl, canonicalOrigin } from "./seo";
import { sanitizePlainText } from "./securityText";

const GEMINI_MODEL = "gemini-3.5-flash-lite";
const UNSUBSCRIBE_TOKEN_MARKER = "{{ALPHA_UNSUBSCRIBE_URL}}";
const FORBIDDEN_NEWSLETTER_HTML = /<\s*(?:script|iframe|object|embed|form|style|link)\b|\son\w+\s*=|javascript\s*:|data\s*:|url\s*\(/i;

const newsletterDraftSchema = z.object({
  subject: z.string().trim().min(4).max(180),
  htmlBody: z.string().trim().min(300).max(30_000),
});

export type NewsletterDraft = z.infer<typeof newsletterDraftSchema>;

function tokenHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function newOpaqueToken() {
  return randomBytes(32).toString("base64url");
}

export const newsletterSubscriptionInputSchema = z.object({
  email: z.string().trim().email().max(320).transform(email => email.toLowerCase()),
});

export async function subscribeToNewsletter(email: string) {
  const token = newOpaqueToken();
  return upsertNewsletterSubscriber({ email, unsubscribeTokenHash: tokenHash(token) });
}

export function unsubscribeTokenHash(token: string) {
  return tokenHash(token);
}

export function newsletterUnsubscribeUrl(token: string) {
  return `${canonicalOrigin()}/api/marketing/unsubscribe?token=${encodeURIComponent(token)}`;
}

function unsubscribeSecret() {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) throw new Error("Newsletter unsubscribe signing is not configured.");
  return secret;
}

export function createNewsletterUnsubscribeToken(subscriberId: number) {
  const value = String(subscriberId);
  const signature = createHmac("sha256", unsubscribeSecret()).update(value).digest("base64url");
  return `${value}.${signature}`;
}

export function verifyNewsletterUnsubscribeToken(token: string): number | null {
  const [rawId, rawSignature, extra] = token.split(".");
  if (!rawId || !rawSignature || extra || !/^\d{1,10}$/.test(rawId) || !/^[A-Za-z0-9_-]{32,64}$/.test(rawSignature)) return null;
  const expected = createHmac("sha256", unsubscribeSecret()).update(rawId).digest("base64url");
  const signature = Buffer.from(rawSignature);
  const expectedBuffer = Buffer.from(expected);
  if (signature.length !== expectedBuffer.length || !timingSafeEqual(signature, expectedBuffer)) return null;
  const subscriberId = Number(rawId);
  return Number.isSafeInteger(subscriberId) && subscriberId > 0 ? subscriberId : null;
}

function newsletterPrompt(products: NewsletterProductSnapshot) {
  return [
    "You are an elite e-commerce email designer and copywriter for Alpha Market, a Nigerian marketplace.",
    "Return only structured JSON with subject and htmlBody. Use the supplied products only. Do not invent discounts, stock levels, time limits, product specifications, delivery promises, warranties, or claims.",
    "Build a clean, modern, responsive email using email-safe HTML and inline CSS only. The HTML must not include script, style, iframe, form, object, embed, JavaScript URLs, or event-handler attributes.",
    "Start with the plain-text heading Fresh Drops and Hot Deals on Alpha Market. For every product, include its supplied absolute HTTPS image URL in an img tag with its title as alt text, its Naira price, a concise two-sentence benefit description grounded only in the supplied description, and a View Product button with its supplied product URL.",
    `Use ${UNSUBSCRIBE_TOKEN_MARKER} exactly once as the final unsubscribe link href. Use a concise professional subject line without emojis.`,
    `Product data: ${JSON.stringify(products)}`,
  ].join("\n");
}

function ensureSafeNewsletterDraft(value: unknown, products: NewsletterProductSnapshot): NewsletterDraft {
  const parsed = newsletterDraftSchema.parse(value);
  const subject = sanitizePlainText(parsed.subject);
  if (subject.length < 4) throw new Error("Gemini returned an invalid newsletter subject.");
  const htmlBody = parsed.htmlBody.trim();
  if (FORBIDDEN_NEWSLETTER_HTML.test(htmlBody)) throw new Error("Gemini returned unsafe newsletter HTML.");
  if (!htmlBody.includes(UNSUBSCRIBE_TOKEN_MARKER)) throw new Error("Gemini did not include the required unsubscribe placeholder.");
  if (htmlBody.split(UNSUBSCRIBE_TOKEN_MARKER).length !== 2) throw new Error("Gemini included an invalid unsubscribe placeholder count.");
  for (const product of products) {
    if (!htmlBody.includes(product.imageUrl) || !htmlBody.includes(product.productUrl)) throw new Error("Gemini omitted a required product image or product link.");
  }
  const allowedUrls = new Set([...products.flatMap(product => [product.imageUrl, product.productUrl]), UNSUBSCRIBE_TOKEN_MARKER]);
  const urlAttributes = Array.from(htmlBody.matchAll(/\b(?:src|href)\s*=\s*(["'])(.*?)\1/gi));
  for (const match of urlAttributes) {
    if (!allowedUrls.has(match[2])) throw new Error("Gemini returned an unapproved newsletter link or asset.");
  }
  return { subject, htmlBody };
}

export function parseGeminiNewsletterDraft(responseText: string, products: NewsletterProductSnapshot): NewsletterDraft {
  return ensureSafeNewsletterDraft(JSON.parse(responseText), products);
}

export async function generateNewsletterDraft(products: NewsletterProductSnapshot): Promise<NewsletterDraft> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("Gemini newsletter generation is not configured.");
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: newsletterPrompt(products) }] }],
      generationConfig: {
        temperature: 0.25,
        responseMimeType: "application/json",
        responseJsonSchema: {
          type: "object",
          properties: { subject: { type: "string" }, htmlBody: { type: "string" } },
          required: ["subject", "htmlBody"],
        },
      },
    }),
  });
  if (!response.ok) throw new Error(`Gemini newsletter request failed with HTTP ${response.status}.`);
  const payload = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const responseText = payload.candidates?.[0]?.content?.parts?.map(part => part.text ?? "").join("").trim();
  if (!responseText) throw new Error("Gemini did not return newsletter content.");
  return parseGeminiNewsletterDraft(responseText, products);
}

export async function stageNewsletterCampaign(createdByUserId: number) {
  const products = await listNewsletterFeaturedProducts(3);
  if (!products.length) throw new Error("No published products from the past seven days have complete trusted margin, image, and description data for a newsletter.");
  const snapshot: NewsletterProductSnapshot = products.map(product => ({
    id: product.id,
    title: sanitizePlainText(product.title),
    price: product.price,
    description: sanitizePlainText(product.description).slice(0, 500),
    imageUrl: absoluteHttpsUrl(product.imageUrl),
    productUrl: absoluteHttpsUrl(`/product/${encodeURIComponent(product.id)}`),
  }));
  const [draft, recipientCount] = await Promise.all([generateNewsletterDraft(snapshot), countActiveNewsletterSubscribers()]);
  const campaign = await createNewsletterCampaign({ createdByUserId, subject: draft.subject, htmlBody: draft.htmlBody, productSnapshot: snapshot, recipientCount });
  if (!campaign) throw new Error("Newsletter draft could not be saved.");
  return campaign;
}

export function previewNewsletterHtml(htmlBody: string) {
  return htmlBody.replaceAll(UNSUBSCRIBE_TOKEN_MARKER, "#unsubscribe-preview");
}

function sendConfiguration() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (process.env.RESEND_NEWSLETTER_ENABLED !== "true") throw new Error("Newsletter delivery is disabled. Set RESEND_NEWSLETTER_ENABLED=true only when you are ready to send a reviewed campaign.");
  if (!apiKey || !from) throw new Error("Newsletter delivery requires RESEND_API_KEY and a verified RESEND_FROM_EMAIL sender.");
  return { apiKey, from };
}

function personalHtml(htmlBody: string, subscriberId: number) {
  return htmlBody.replace(UNSUBSCRIBE_TOKEN_MARKER, newsletterUnsubscribeUrl(createNewsletterUnsubscribeToken(subscriberId)));
}

export async function sendStagedNewsletterCampaign(input: { campaignId: number; userId: number; confirmation: string }) {
  if (input.confirmation !== "SEND NEWSLETTER") throw new Error("Type SEND NEWSLETTER to confirm this broadcast.");
  const configuration = sendConfiguration();
  const campaign = await claimNewsletterCampaignForSend({ campaignId: input.campaignId, userId: input.userId });
  if (!campaign) throw new Error("This campaign is no longer an unsent draft owned by your administrator account.");
  const subscribers = await listActiveNewsletterSubscribers();
  if (!subscribers.length) {
    await finishNewsletterCampaign({ campaignId: campaign.id, status: "failed", failureSummary: "No active subscribers at confirmation." });
    throw new Error("There are no active newsletter subscribers to receive this campaign.");
  }
  if (subscribers.length !== campaign.recipientCount) {
    await finishNewsletterCampaign({ campaignId: campaign.id, status: "failed", failureSummary: "Active recipient count changed after preview." });
    throw new Error("The active recipient count changed after your review. Generate a fresh draft and verify the new audience before sending.");
  }
  const resend = new Resend(configuration.apiKey);
  let sent = 0;
  let failed = 0;
  for (const subscriber of subscribers) {
    const delivery = await createNewsletterDelivery({ campaignId: campaign.id, subscriberId: subscriber.id, idempotencyKey: `newsletter/${campaign.id}/subscriber/${subscriber.id}` });
    if (!delivery) { failed += 1; continue; }
    try {
      const { data, error } = await resend.emails.send({
        from: configuration.from,
        to: [subscriber.email],
        subject: campaign.subject,
        html: personalHtml(campaign.htmlBody, subscriber.id),
        headers: { "List-Unsubscribe": `<${newsletterUnsubscribeUrl(createNewsletterUnsubscribeToken(subscriber.id))}>`, "Idempotency-Key": `newsletter/${campaign.id}/subscriber/${subscriber.id}` },
      });
      if (error || !data?.id) {
        failed += 1;
        await updateNewsletterDelivery({ id: delivery.id, status: "failed", failureSummary: sanitizePlainText(error?.message || "Resend did not return a message ID.").slice(0, 255) });
        continue;
      }
      sent += 1;
      await updateNewsletterDelivery({ id: delivery.id, status: "sent", providerMessageId: data.id });
      await markNewsletterSubscriberEmailed(subscriber.id);
    } catch (error) {
      failed += 1;
      await updateNewsletterDelivery({ id: delivery.id, status: "failed", failureSummary: sanitizePlainText(error instanceof Error ? error.message : "Newsletter provider request failed.").slice(0, 255) });
    }
  }
  await finishNewsletterCampaign({ campaignId: campaign.id, status: failed ? "failed" : "sent", failureSummary: failed ? `${failed} delivery attempts failed; ${sent} sent.` : null });
  return { campaignId: campaign.id, sent, failed, total: subscribers.length };
}

export async function getNewsletterDraftForPreview(campaignId: number, userId: number) {
  const campaign = await getNewsletterCampaign(campaignId);
  if (!campaign || campaign.createdByUserId !== userId) return null;
  return { ...campaign, htmlPreview: previewNewsletterHtml(campaign.htmlBody) };
}
