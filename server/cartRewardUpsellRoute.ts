import type { Express, Request, Response } from "express";
import { cartRewardUpsellInputSchema, getCartRewardUpsells } from "./cartRewardUpsell";
import { createExpressRateLimit } from "./requestRateLimit";

export function registerCartRewardUpsellRoute(app: Express) {
  app.post("/api/rewards/smart-upsell", createExpressRateLimit({ scope: "cart-reward-upsell", limit: 12, windowMs: 60_000 }), async (req: Request, res: Response) => {
    const parsed = cartRewardUpsellInputSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Send up to 12 valid cart items." });
    try {
      res.set("Cache-Control", "no-store").json(await getCartRewardUpsells(parsed.data));
    } catch (error) {
      console.warn("[Cart reward upsell] Request failed:", error instanceof Error ? error.message : error);
      res.status(503).json({ error: "Reward recommendations are temporarily unavailable." });
    }
  });
}
