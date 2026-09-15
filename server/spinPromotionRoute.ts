import type { Express, Request, Response } from "express";
import { createExpressRateLimit } from "./requestRateLimit";
import { claimSpinReward, getPublicSpinPromotionSettings, spinClaimInputSchema } from "./spinPromotion";

export function registerSpinPromotionRoute(app: Express) {
  app.get("/api/rewards/spin-claim", async (_req: Request, res: Response) => {
    try { res.set("Cache-Control", "no-store").json(await getPublicSpinPromotionSettings()); } catch { res.status(503).set("Cache-Control", "no-store").json({ enabled: false }); }
  });
  app.post("/api/rewards/spin-claim", createExpressRateLimit({ scope: "spin-claim", limit: 5, windowMs: 10 * 60_000 }), async (req: Request, res: Response) => {
    const parsed = spinClaimInputSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).set("Cache-Control", "no-store").json({ error: "Invalid spin claim request." });
    try { return res.set("Cache-Control", "no-store").json(await claimSpinReward(parsed.data)); } catch { return res.status(503).set("Cache-Control", "no-store").json({ error: "The promotion is temporarily unavailable. Please try again." }); }
  });
}
