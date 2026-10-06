import type { Express, Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { syncAllSupplierApis } from "./supplierImport";

export function registerAdminSupplierRoutes(app: Express) {
  app.post("/api/admin/suppliers/sync-all", async (req: Request, res: Response) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (user.role !== "admin") return res.status(403).json({ error: "Administrator access required." });
      const result = await syncAllSupplierApis();
      return res.status(200).json({ ok: true, ...result });
    } catch (error) {
      console.error("[Supplier sync] failed", error);
      return res.status(error instanceof Error && error.message.includes("Invalid session") ? 401 : 500).json({ ok: false, error: error instanceof Error ? error.message : "Supplier synchronization failed." });
    }
  });
}
