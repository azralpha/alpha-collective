import express, { type Express } from "express";
import { creditVerifiedWalletFunding, getWalletFundingAttemptByReference, settleCartRewardClaimAfterVerifiedPayment, settleSpinRewardAfterVerifiedPayment } from "./db";
import { verifyFlutterwaveTransaction, verifyFlutterwaveWebhookSignature } from "./flutterwave";
import { notifyAdminPaymentEvent } from "./paymentNotifications";
import { issueGiftCardFromFlutterwave } from "./giftCards";

type FlutterwaveWebhookEvent = {
  type?: unknown;
  data?: { id?: unknown; tx_ref?: unknown; reference?: unknown };
};

function eventTransactionId(event: FlutterwaveWebhookEvent) {
  return typeof event.data?.id === "string" || typeof event.data?.id === "number" ? String(event.data.id) : null;
}

async function reconcileFunding(event: FlutterwaveWebhookEvent) {
  const transactionId = eventTransactionId(event);
  if (!transactionId) return null;
  const verified = await verifyFlutterwaveTransaction(transactionId);
  const attempt = await getWalletFundingAttemptByReference(verified.reference);
  if (!attempt) return null;
  if (attempt.provider !== "flutterwave" || verified.status !== "successful" || verified.currency !== "NGN" || verified.amountNaira !== attempt.amount) {
    throw new Error("Verified Flutterwave funding did not match its stored attempt.");
  }
  const settlement = await creditVerifiedWalletFunding({ reference: verified.reference, providerTransactionId: verified.id, provider: "flutterwave" });
  if (settlement && !settlement.alreadyProcessed && settlement.checkoutOrderReference) {
    await settleCartRewardClaimAfterVerifiedPayment(settlement.checkoutOrderReference);
    await settleSpinRewardAfterVerifiedPayment(settlement.checkoutOrderReference);
  }
  return { reference: verified.reference, amount: attempt.amount };
}

export async function processFlutterwaveWebhook(event: FlutterwaveWebhookEvent) {
  if (event.type !== "charge.completed") return;
  const eventReference = typeof event.data?.tx_ref === "string" ? event.data.tx_ref : typeof event.data?.reference === "string" ? event.data.reference : "";
  if (eventReference.startsWith("ALPHA-GC-")) {
    const giftCard = await issueGiftCardFromFlutterwave({ transactionId: eventTransactionId(event) ?? "" });
    void giftCard;
    return;
  }
  const funding = await reconcileFunding(event);
  if (funding) void notifyAdminPaymentEvent({ event: "wallet_funding_confirmed", reference: funding.reference, amountNaira: funding.amount });
}

export function registerFlutterwaveWebhook(app: Express) {
  app.post("/api/flutterwave/webhook", express.raw({ type: "application/json", limit: "1mb" }), async (req, res) => {
    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from("");
    if (!verifyFlutterwaveWebhookSignature(rawBody, req.header("flutterwave-signature") ?? undefined)) {
      res.status(401).json({ received: false });
      return;
    }
    let event: FlutterwaveWebhookEvent;
    try { event = JSON.parse(rawBody.toString("utf8")) as FlutterwaveWebhookEvent; } catch { res.status(400).json({ received: false }); return; }
    try {
      await processFlutterwaveWebhook(event);
      res.status(200).json({ received: true });
    } catch (error) {
      console.error("[Flutterwave webhook] Reconciliation failed", { type: event.type, message: error instanceof Error ? error.message : "Unknown error" });
      res.status(500).json({ received: false });
    }
  });
}
