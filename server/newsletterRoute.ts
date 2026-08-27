import type { Express, Request, Response } from "express";
import { z } from "zod";
import { unsubscribeNewsletterSubscriberById } from "./db";
import { newsletterSubscriptionInputSchema, stageNewsletterCampaign, subscribeToNewsletter, verifyNewsletterUnsubscribeToken, sendStagedNewsletterCampaign } from "./newsletter";
import { createExpressRateLimit } from "./requestRateLimit";
import { sdk } from "./_core/sdk";

const adminActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("draft") }),
  z.object({ action: z.literal("send"), campaignId: z.number().int().positive(), confirmation: z.string().max(32) }),
]);

async function requireAdmin(req: Request) {
  const user = await sdk.authenticateRequest(req);
  if (user.role !== "admin") throw new Error("Administrator access required.");
  return user;
}

function unsubscribeHtml(message: string) {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" /><title>Alpha Market newsletter</title></head><body style="margin:0;background:#f6f6ef;color:#173b2a;font:16px Arial,sans-serif"><main style="max-width:560px;margin:64px auto;padding:32px;background:#fff;border-radius:18px"><h1 style="margin-top:0">Alpha Market</h1><p>${message}</p><p><a href="/" style="color:#08734a">Return to the shop</a></p></main></body></html>`;
}

export function registerNewsletterRoutes(app: Express) {
  app.post("/api/marketing/subscribe", createExpressRateLimit({ scope: "newsletter-subscribe", limit: 5, windowMs: 60_000 }), async (req: Request, res: Response) => {
    const parsed = newsletterSubscriptionInputSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).set("Cache-Control", "no-store").json({ error: "Enter a valid email address." });
    try {
      await subscribeToNewsletter(parsed.data.email);
      return res.status(201).set("Cache-Control", "no-store").json({ subscribed: true });
    } catch (error) {
      console.warn("[Newsletter] Subscription failed:", error instanceof Error ? error.message : error);
      return res.status(503).set("Cache-Control", "no-store").json({ error: "Newsletter signup is temporarily unavailable. Please try again later." });
    }
  });

  app.get("/api/marketing/unsubscribe", createExpressRateLimit({ scope: "newsletter-unsubscribe", limit: 10, windowMs: 60_000 }), async (req: Request, res: Response) => {
    const token = typeof req.query.token === "string" ? req.query.token : null;
    if (!token) return res.status(400).set("Cache-Control", "no-store").type("html").send(unsubscribeHtml("This unsubscribe link is invalid."));
    try {
      const subscriberId = verifyNewsletterUnsubscribeToken(token);
      if (!subscriberId) return res.status(400).set("Cache-Control", "no-store").type("html").send(unsubscribeHtml("This unsubscribe link is invalid."));
      await unsubscribeNewsletterSubscriberById(subscriberId);
      return res.status(200).set("Cache-Control", "no-store").type("html").send(unsubscribeHtml("You have been unsubscribed from Alpha Market emails."));
    } catch {
      return res.status(503).set("Cache-Control", "no-store").type("html").send(unsubscribeHtml("We could not process your request right now. Please try again later."));
    }
  });

  app.post("/api/marketing/auto-newsletter", createExpressRateLimit({ scope: "newsletter-admin", limit: 6, windowMs: 60_000 }), async (req: Request, res: Response) => {
    const parsed = adminActionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).set("Cache-Control", "no-store").json({ error: "Use a valid newsletter action." });
    try {
      const user = await requireAdmin(req);
      if (parsed.data.action === "draft") return res.set("Cache-Control", "no-store").json({ campaign: await stageNewsletterCampaign(user.id) });
      return res.set("Cache-Control", "no-store").json({ result: await sendStagedNewsletterCampaign({ campaignId: parsed.data.campaignId, userId: user.id, confirmation: parsed.data.confirmation }) });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Newsletter action could not be completed.";
      const status = /Administrator access|required|invalid session/i.test(message) ? 403 : 422;
      return res.status(status).set("Cache-Control", "no-store").json({ error: message });
    }
  });
}
