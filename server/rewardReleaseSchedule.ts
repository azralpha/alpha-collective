import type { Express, Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { releaseMatureBonusRewards } from "./db";

/**
 * This endpoint is inert until a project-level scheduled job is created after
 * publication. It never trusts request-body values and releases only mature,
 * still-pending reward holds through an idempotent database claim.
 */
export function registerRewardReleaseSchedule(app: Express) {
  app.post("/api/scheduled/release-shopping-bonuses", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
      const result = await releaseMatureBonusRewards(new Date(), 100);
      return res.json({ ok: true, ...result });
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : "Shopping-bonus release failed",
        timestamp: new Date().toISOString(),
      });
    }
  });
}
