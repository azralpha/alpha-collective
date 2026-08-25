import express, { type Express } from "express";
import {
  creditVerifiedWalletFunding,
  getWalletFundingAttemptByReference,
  markWalletWithdrawalPaid,
  reverseWalletWithdrawal,
} from "./db";
import { verifyPaystackTransaction, verifyPaystackWebhookSignature } from "./paystack";
import { notifyAdminPaymentEvent } from "./paymentNotifications";

type PaystackWebhookEvent = {
  event?: unknown;
  data?: { reference?: unknown; transfer_code?: unknown };
};

function webhookReference(event: PaystackWebhookEvent) {
  return typeof event.data?.reference === "string" && event.data.reference.length <= 64 ? event.data.reference : null;
}

async function reconcileFunding(reference: string) {
  const attempt = await getWalletFundingAttemptByReference(reference);
  if (!attempt) return null;
  const verified = await verifyPaystackTransaction(reference);
  if (verified.reference !== reference || verified.status !== "success" || verified.amountKobo !== attempt.amount * 100) {
    throw new Error("Verified Paystack funding did not match its stored wallet attempt.");
  }
  await creditVerifiedWalletFunding({ reference, providerTransactionId: verified.id });
  return attempt.amount;
}

export async function processPaystackWebhook(event: PaystackWebhookEvent) {
  const reference = webhookReference(event);
  if (!reference || typeof event.event !== "string") return;
  if (event.event === "charge.success") {
    const amount = await reconcileFunding(reference);
    if (amount !== null) void notifyAdminPaymentEvent({ event: "wallet_funding_confirmed", reference, amountNaira: amount });
    return;
  }
  if (event.event === "transfer.success") {
    await markWalletWithdrawalPaid({
      reference,
      providerTransferCode: typeof event.data?.transfer_code === "string" ? event.data.transfer_code : undefined,
    });
    return;
  }
  if (event.event === "transfer.failed" || event.event === "transfer.reversed") {
    await reverseWalletWithdrawal({
      reference,
      outcome: event.event === "transfer.failed" ? "failed" : "reversed",
      providerTransferCode: typeof event.data?.transfer_code === "string" ? event.data.transfer_code : undefined,
    });
  }
}

export function registerPaystackWebhook(app: Express) {
  app.post("/api/paystack/webhook", express.raw({ type: "application/json", limit: "1mb" }), async (req, res) => {
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from("");
    const signatureHeader = req.header("x-paystack-signature") ?? undefined;
    if (!verifyPaystackWebhookSignature(rawBody, signatureHeader)) {
      res.status(401).json({ received: false });
      return;
    }
    let event: PaystackWebhookEvent;
    try {
      event = JSON.parse(rawBody.toString("utf8")) as PaystackWebhookEvent;
    } catch {
      res.status(400).json({ received: false });
      return;
    }
    try {
      await processPaystackWebhook(event);
      res.status(200).json({ received: true });
    } catch (error) {
      console.error("[Paystack webhook] Reconciliation failed", { event: event.event, message: error instanceof Error ? error.message : "Unknown error" });
      res.status(500).json({ received: false });
    }
  });
}
