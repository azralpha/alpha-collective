import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  claimDueFulfilmentJobs: vi.fn(),
  getFulfilmentIntegration: vi.fn(),
  markFulfilmentJobFailed: vi.fn(),
  markFulfilmentJobSubmitted: vi.fn(),
  recoverStaleFulfilmentJobClaims: vi.fn(),
  createCjOrder: vi.fn(),
  isCjDropshippingConfigured: vi.fn(),
}));

vi.mock("./db", () => mocks);
vi.mock("./cjDropshipping", async () => {
  class CjDropshippingError extends Error { constructor(message: string, readonly statusCode?: number, readonly retryable = false) { super(message); } }
  return { ...mocks, CjDropshippingError };
});

import { processCjFulfilmentQueue } from "./fulfilmentQueue";
import { CjDropshippingError } from "./cjDropshipping";

const job = {
  id: 44, orderReference: "AC-QUEUE-001", officialProductId: 5, provider: "cj_dropshipping" as const, status: "processing" as const,
  externalSkuSnapshot: "CJ-005", quantity: 2, deliverySnapshot: { buyerName: "Ada Okafor", buyerPhone: "08000000000", deliveryAddress: "NIGERIA, LAGOS, IKEJA, 12 Oyan Road", countryCode: "NG" as const, state: "Lagos", lga: "Ikeja", streetDetails: "12 Oyan Road" },
  attemptCount: 1,
};

describe("durable CJ fulfilment queue", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.getFulfilmentIntegration.mockResolvedValue({ enabled: 1, defaultLogisticsName: "CJPacket", defaultFromCountryCode: "CN", orderMode: "create_only" });
    mocks.isCjDropshippingConfigured.mockReturnValue(true);
    mocks.claimDueFulfilmentJobs.mockResolvedValue([job]);
  });

  it("does not claim or dispatch jobs while CJ activation is disabled", async () => {
    mocks.getFulfilmentIntegration.mockResolvedValue({ enabled: 0 });
    await expect(processCjFulfilmentQueue()).resolves.toEqual({ processed: 0, skipped: "provider_not_activated" });
    expect(mocks.claimDueFulfilmentJobs).not.toHaveBeenCalled();
    expect(mocks.createCjOrder).not.toHaveBeenCalled();
  });

  it("submits a claimed job using private delivery data and records the provider order id", async () => {
    mocks.createCjOrder.mockResolvedValue({ orderId: "CJ-ORDER-44", requestId: "CJ-REQ-44" });
    await expect(processCjFulfilmentQueue()).resolves.toEqual({ processed: 1, skipped: null });
    expect(mocks.recoverStaleFulfilmentJobClaims).toHaveBeenCalledWith(expect.any(Date));
    expect(mocks.createCjOrder).toHaveBeenCalledWith(expect.objectContaining({ orderNumber: "AC-QUEUE-001", externalSkuId: "CJ-005", quantity: 2, state: "Lagos", lga: "Ikeja", logisticsName: "CJPacket" }));
    expect(mocks.markFulfilmentJobSubmitted).toHaveBeenCalledWith({ id: 44, providerOrderId: "CJ-ORDER-44", providerRequestId: "CJ-REQ-44" });
  });

  it("keeps a temporary supplier failure non-blocking and schedules a bounded retry", async () => {
    mocks.createCjOrder.mockRejectedValue(new CjDropshippingError("CJ timeout", 503, true));
    await processCjFulfilmentQueue();
    expect(mocks.markFulfilmentJobFailed).toHaveBeenCalledWith({ id: 44, errorSummary: "CJ timeout", retryAt: expect.any(Date) });
  });

  it("flags a permanent supplier validation failure for manual processing instead of failing the customer order", async () => {
    mocks.createCjOrder.mockRejectedValue(new CjDropshippingError("CJ rejected SKU", 400, false));
    await processCjFulfilmentQueue();
    expect(mocks.markFulfilmentJobFailed).toHaveBeenCalledWith({ id: 44, errorSummary: "CJ rejected SKU", retryAt: null });
  });
});
