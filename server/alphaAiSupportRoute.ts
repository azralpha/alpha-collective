import type { Express, Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { answerAlphaAiSupport, alphaAiSupportInputSchema } from "./alphaAiSupport";
import { createExpressRateLimit } from "./requestRateLimit";

export function registerAlphaAiSupportRoute(app: Express) {
  app.post("/api/chat/support", createExpressRateLimit({ scope: "alpha-ai-support", limit: 15, windowMs: 60_000 }), async (req: Request, res: Response) => {
    const parsed = alphaAiSupportInputSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Send between 1 and 12 short chat messages." });
    try {
      let userId: number | undefined;
      try { userId = (await sdk.authenticateRequest(req)).id; } catch { userId = undefined; }
      const result = await answerAlphaAiSupport({ userId, messages: parsed.data.messages });
      res.set("Cache-Control", "no-store").json(result);
    } catch (error) {
      console.warn("[Alpha AI Support] Request failed:", error instanceof Error ? error.message : error);
      res.status(503).json({ error: "Alpha AI Support is temporarily unavailable. Please try again shortly." });
    }
  });
}
