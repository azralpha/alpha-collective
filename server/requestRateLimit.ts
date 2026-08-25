import type { NextFunction, Request, Response } from "express";
import { extractClientIp } from "./referralFraud";
import { FixedWindowRateLimiter } from "./performanceControls";

const expressLimiter = new FixedWindowRateLimiter();

export function createExpressRateLimit(input: { scope: string; limit: number; windowMs: number }) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = extractClientIp(req) ?? "unknown";
    const result = expressLimiter.consume({ key: `${input.scope}:ip:${ip}`, limit: input.limit, windowMs: input.windowMs });
    if (result.allowed) return next();
    res.set("Retry-After", String(result.retryAfterSeconds));
    res.status(429).json({ error: "Too many requests. Please try again shortly." });
  };
}
