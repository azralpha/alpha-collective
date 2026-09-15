import type { Express, Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { processCjFulfilmentQueue } from "./fulfilmentQueue";

export function registerCjFulfilmentSchedule(app: Express) {
  app.post("/api/scheduled/cj-fulfilment-retry", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
      const result = await processCjFulfilmentQueue(10);
      return res.json({ ok: true, ...result });
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : "CJ fulfilment retry failed", timestamp: new Date().toISOString() });
    }
  });
}
