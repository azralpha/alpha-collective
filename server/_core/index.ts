import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { registerPaystackWebhook } from "../paystackWebhook";
import { registerFlutterwaveWebhook } from "../flutterwaveWebhook";
import { registerCjFulfilmentSchedule } from "../cjFulfilmentSchedule";
import { registerCjInventorySyncSchedule } from "../cjInventorySync";
import { registerRewardReleaseSchedule } from "../rewardReleaseSchedule";
import { registerVendorRewardsSchedule } from "../vendorRewardsSchedule";
import { registerEscrowReleaseSchedule } from "../escrowReleaseSchedule";
import { registerNowPaymentsWebhook } from "../nowpaymentsWebhook";
import { createExpressRateLimit } from "../requestRateLimit";
import { getPublicCatalogueRevision, PRIVATE_API_CACHE_CONTROL, PUBLIC_CATALOGUE_CACHE_CONTROL } from "../performanceControls";
import { registerSeoRoutes } from "../seo";
import { registerAlphaAiSupportRoute } from "../alphaAiSupportRoute";
import { registerCartRewardUpsellRoute } from "../cartRewardUpsellRoute";
import { registerSpinPromotionRoute } from "../spinPromotionRoute";
import { registerNewsletterRoutes } from "../newsletterRoute";
import { registerBankVerificationRoute } from "../bankVerificationRoute";
import { registerTaskRewardsRoutes } from "../taskRewardsRoute";
import { registerCors } from "./cors";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  app.set("trust proxy", 1);
  registerCors(app);
  const server = createServer(app);
  registerNowPaymentsWebhook(app);
  app.use("/api/oauth/callback", createExpressRateLimit({ scope: "oauth-callback", limit: 20, windowMs: 60_000 }));
  registerPaystackWebhook(app);
  registerFlutterwaveWebhook(app);
  registerTaskRewardsRoutes(app);
  registerCjFulfilmentSchedule(app);
  registerCjInventorySyncSchedule(app);
  registerRewardReleaseSchedule(app);
  registerVendorRewardsSchedule(app);
  registerEscrowReleaseSchedule(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerSeoRoutes(app);
  registerAlphaAiSupportRoute(app);
  registerCartRewardUpsellRoute(app);
  registerSpinPromotionRoute(app);
  registerNewsletterRoutes(app);
  registerBankVerificationRoute(app);
  registerOAuthRoutes(app);
  app.use("/api/trpc", (req, res, next) => {
    const paths = req.path.split(",").map(path => path.replace(/^\//, ""));
    const isCatalogueRead = req.method === "GET" && paths.length > 0 && paths.every(path => path === "marketplace.publicProducts");
    res.set("Cache-Control", isCatalogueRead ? PUBLIC_CATALOGUE_CACHE_CONTROL : PRIVATE_API_CACHE_CONTROL);
    if (isCatalogueRead) res.set("X-Alpha-Catalogue-Revision", String(getPublicCatalogueRevision()));
    next();
  });
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
