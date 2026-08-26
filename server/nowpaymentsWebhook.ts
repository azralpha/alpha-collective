import type { Express, Request, Response } from "express";
import express from "express";
import { creditVerifiedCryptoFunding, getCryptoFundingAttemptByReference, markCryptoFundingAttemptStatus, settleCartRewardClaimAfterVerifiedPayment } from "./db";
import { getVerifiedNowPaymentsPayment, verifyNowPaymentsIpn } from "./nowpayments";
import { notifyAdminPaymentEvent } from "./paymentNotifications";

type NowPaymentsIpn = Record<string, unknown>;

function stringField(payload: NowPaymentsIpn, field: string, maxLength: number) {
  const value = payload[field];
  return (typeof value === "string" || typeof value === "number") && String(value).length > 0 && String(value).length <= maxLength ? String(value) : null;
}

export function verifiedNowPaymentsPaymentMatchesAttempt(input: {
  attempt: { reference: string; amountNaira: number; payCurrency: string };
  payment: { orderId: string; priceCurrency: string; priceAmount: number; payCurrency: string };
}) {
  return input.payment.orderId === input.attempt.reference
    && input.payment.priceCurrency === "ngn"
    && Math.round(input.payment.priceAmount) === input.attempt.amountNaira
    && input.payment.payCurrency === input.attempt.payCurrency.toLowerCase();
}

export async function processNowPaymentsIpn(payload: NowPaymentsIpn) {
  const reference = stringField(payload, "order_id", 64);
  const paymentId = stringField(payload, "payment_id", 80);
  if (!reference || !paymentId || !/^accrypto_[a-z0-9]{16,32}$/.test(reference)) return { ignored: true } as const;
  const attempt = await getCryptoFundingAttemptByReference(reference);
  if (!attempt) return { ignored: true } as const;
  const verified = await getVerifiedNowPaymentsPayment(paymentId);
  const matchesAttempt = verifiedNowPaymentsPaymentMatchesAttempt({ attempt, payment: verified });
  if (!matchesAttempt) throw new Error("Verified NOWPayments payment did not match its stored crypto funding attempt.");
  if (verified.status === "failed" || verified.status === "expired") {
    await markCryptoFundingAttemptStatus({ reference, status: verified.status });
    return { credited: false, status: verified.status } as const;
  }
  if (verified.status !== "finished") return { credited: false, status: verified.status } as const;
  const result = await creditVerifiedCryptoFunding({ reference, providerPaymentId: verified.paymentId });
  if (!result.alreadyProcessed && result.checkoutOrderReference) await settleCartRewardClaimAfterVerifiedPayment(result.checkoutOrderReference);
  if (!result.alreadyProcessed) void notifyAdminPaymentEvent({ event: "wallet_funding_confirmed", reference, amountNaira: attempt.amountNaira });
  return { credited: !result.alreadyProcessed, status: "finished" as const };
}

export function registerNowPaymentsWebhook(app: Express) {
  app.post("/api/webhooks/nowpayments", express.json({ limit: "64kb" }), async (req: Request, res: Response) => {
    const payload = req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body as NowPaymentsIpn : null;
    if (!payload || !verifyNowPaymentsIpn(payload, req.header("x-nowpayments-sig") ?? undefined)) {
      res.status(401).json({ received: false });
      return;
    }
    try {
      await processNowPaymentsIpn(payload);
      res.status(200).json({ received: true });
    } catch (error) {
      console.error("[NOWPayments webhook] Reconciliation failed", { message: error instanceof Error ? error.message : "Unknown error" });
      res.status(500).json({ received: false });
    }
  });
}
