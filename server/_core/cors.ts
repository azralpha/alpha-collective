import type { Express, Request, Response, NextFunction } from "express";

const DEFAULT_ALLOWED_ORIGINS = [
  "https://alphamarket.name.ng",
  "https://www.alphamarket.name.ng",
];

function configuredOrigins() {
  const configured = String(process.env.CORS_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map(origin => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  return new Set(configured.length ? configured : DEFAULT_ALLOWED_ORIGINS);
}

export function isAllowedCorsOrigin(origin: string | undefined) {
  if (!origin) return false;
  return configuredOrigins().has(origin.replace(/\/+$/, ""));
}

export function registerCors(app: Express) {
  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.get("origin");
    if (isAllowedCorsOrigin(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin!);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Alpha-Device-Id");
      res.setHeader("Vary", "Origin");
    }

    if (req.method === "OPTIONS") {
      if (!isAllowedCorsOrigin(origin)) {
        res.status(403).end();
        return;
      }
      res.status(204).end();
      return;
    }

    next();
  });
}
