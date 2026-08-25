import {
  claimDueFulfilmentJobs,
  getFulfilmentIntegration,
  markFulfilmentJobFailed,
  markFulfilmentJobSubmitted,
  recoverStaleFulfilmentJobClaims,
} from "./db";
import { CjDropshippingError, createCjOrder, isCjDropshippingConfigured } from "./cjDropshipping";

const MAX_ATTEMPTS = 3;

function retryAt(attemptCount: number) {
  return new Date(Date.now() + Math.min(60, 5 * 2 ** Math.max(0, attemptCount - 1)) * 60_000);
}

export async function processCjFulfilmentQueue(limit = 10) {
  const integration = await getFulfilmentIntegration("cj_dropshipping");
  if (!integration?.enabled || !isCjDropshippingConfigured()) return { processed: 0, skipped: "provider_not_activated" as const };
  if (!integration.defaultLogisticsName || !integration.defaultFromCountryCode) return { processed: 0, skipped: "missing_logistics_configuration" as const };
  await recoverStaleFulfilmentJobClaims(new Date(Date.now() - 15 * 60_000));
  const jobs = await claimDueFulfilmentJobs(limit);
  let processed = 0;
  for (const job of jobs) {
    if (job.provider !== "cj_dropshipping") continue;
    try {
      const result = await createCjOrder({
        orderNumber: job.orderReference,
        externalSkuId: job.externalSkuSnapshot,
        quantity: job.quantity,
        buyerName: job.deliverySnapshot.buyerName,
        buyerPhone: job.deliverySnapshot.buyerPhone,
        state: job.deliverySnapshot.state,
        lga: job.deliverySnapshot.lga,
        streetDetails: job.deliverySnapshot.streetDetails,
        logisticsName: integration.defaultLogisticsName,
        fromCountryCode: integration.defaultFromCountryCode,
        orderMode: integration.orderMode,
      });
      await markFulfilmentJobSubmitted({ id: job.id, providerOrderId: result.orderId, providerRequestId: result.requestId });
      processed += 1;
    } catch (error) {
      const providerError = error instanceof CjDropshippingError ? error : new CjDropshippingError("The supplier request failed unexpectedly.", 500, true);
      const retryable = providerError.retryable && job.attemptCount < MAX_ATTEMPTS;
      await markFulfilmentJobFailed({ id: job.id, errorSummary: providerError.message, retryAt: retryable ? retryAt(job.attemptCount) : null });
    }
  }
  return { processed, skipped: null };
}
