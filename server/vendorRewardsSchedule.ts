import type { Express, Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { evaluateMonthlyVendorRewards, getRewardsAutomationSettings, rewardMonthKey } from "./db";

export function registerVendorRewardsSchedule(app: Express) {
  app.post("/api/scheduled/monthly-vendor-rewards", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
      const settings = await getRewardsAutomationSettings();
      if (settings.monthlyVendorRewardsScheduleTaskUid !== user.taskUid) return res.json({ ok: true, skipped: "orphan" });
      const now = new Date();
      const previousMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
      const result = await evaluateMonthlyVendorRewards(rewardMonthKey(previousMonth));
      return res.json({ ok: true, ...result });
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : "Monthly vendor reward evaluation failed", timestamp: new Date().toISOString() });
    }
  });
}
