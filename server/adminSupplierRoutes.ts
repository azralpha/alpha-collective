import type { Express, Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { syncAllSupplierApis } from "./supplierImport";
import { registerAliExpressOAuthRoutes } from "./aliexpressOAuth";
import { createExpressRateLimit } from "./requestRateLimit";

export function registerAdminSupplierRoutes(app: Express) {
  registerAliExpressOAuthRoutes(app);
  app.post("/api/admin/suppliers/sync-all", createExpressRateLimit({ scope: "admin-supplier-sync", limit: 10, windowMs: 60_000 }), async (req: Request, res: Response) => {
    try {
      await sdk.authenticateAdminRequest(req);
      const result = await syncAllSupplierApis();
      return res.status(200).json({ ok: true, ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Supplier synchronization failed.";
      const status = /Administrator access|required|invalid session/i.test(message) ? 403 : /too many requests/i.test(message) ? 429 : 500;
      if (status === 500) console.error("[Supplier sync] failed", message);
      return res.status(status).json({ ok: false, error: status === 500 ? "Supplier synchronization failed." : message });
    }
  });
}
