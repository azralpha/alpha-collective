import express, { type Express, type Request, type Response } from "express";
import { extractClientIp } from "./referralFraud";
import { releaseMatureTaskRewards, reverseTaskReward, settleTaskReward, verifyTaskRewardSignature } from "./taskRewards";

export function registerTaskRewardsRoutes(app: Express) {
  app.post("/api/webhooks/task-rewards", express.raw({ type: "application/json", limit: "64kb" }), async (req: Request, res: Response) => {
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from("");
    if (!verifyTaskRewardSignature(rawBody, req.header("x-task-rewards-signature") ?? req.header("x-signature"))) {
      console.warn("[Task rewards] rejected unverified callback", { ip: extractClientIp(req) });
      res.status(401).json({ received: false });
      return;
    }
    try {
      const payload = JSON.parse(rawBody.toString("utf8")) as { transactionId?: unknown; userId?: unknown; provider?: unknown; taskName?: unknown; payoutAmount?: unknown; status?: unknown };
      const transactionId = typeof payload.transactionId === "string" ? payload.transactionId : "";
      const provider = typeof payload.provider === "string" ? payload.provider : "";
      const userId = typeof payload.userId === "number" ? payload.userId : Number(payload.userId);
      const payoutAmount = typeof payload.payoutAmount === "number" ? payload.payoutAmount : Number(payload.payoutAmount);
      if (payload.status === "reversed" || payoutAmount < 0) {
        const result = await reverseTaskReward({ transactionId });
        res.status(200).json({ received: true, ...result });
        return;
      }
      const result = await settleTaskReward({ transactionId, userId, provider, taskName: typeof payload.taskName === "string" ? payload.taskName : undefined, payoutAmount, status: payload.status === "pending" ? "pending" : "completed" });
      res.status(200).json({ received: true, ...result });
    } catch (error) {
      console.error("[Task rewards] callback processing failed", error);
      res.status(400).json({ received: false });
    }
  });
  app.post("/api/scheduled/release-task-rewards", express.json({ limit: "16kb" }), async (_req, res) => {
    try { res.status(200).json(await releaseMatureTaskRewards()); } catch (error) { console.error("[Task rewards] release failed", error); res.status(500).json({ released: 0 }); }
  });
}
