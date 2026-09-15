import type { Express, Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { releaseMatureLocalVendorEscrows } from "./db";

/** Inert until an administrator creates the project-owned schedule after publication. */
export function registerEscrowReleaseSchedule(app: Express) {
  app.post("/api/scheduled/release-mature-local-vendor-escrows", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
      return res.json({ ok: true, ...(await releaseMatureLocalVendorEscrows()) });
    } catch (error) {
      return res.status(500).json({ error: error instanceof Error ? error.message : "Escrow fallback release failed", timestamp: new Date().toISOString() });
    }
  });
}
