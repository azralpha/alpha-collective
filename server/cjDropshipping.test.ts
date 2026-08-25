import { afterEach, describe, expect, it, vi } from "vitest";

const originalKey = process.env.CJ_DROPSHIPPING_API_KEY;

afterEach(() => {
  if (originalKey === undefined) delete process.env.CJ_DROPSHIPPING_API_KEY;
  else process.env.CJ_DROPSHIPPING_API_KEY = originalKey;
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("CJ Dropshipping adapter", () => {
  it("fails closed without a server-only CJ API key", async () => {
    delete process.env.CJ_DROPSHIPPING_API_KEY;
    const { createCjOrder } = await import("./cjDropshipping");
    await expect(createCjOrder({ orderNumber: "AC-TEST", externalSkuId: "CJ-001", quantity: 1, buyerName: "Ada Okafor", buyerPhone: "08000000000", state: "Lagos", lga: "Ikeja", streetDetails: "12 Oyan Road", logisticsName: "CJPacket", fromCountryCode: "CN", orderMode: "create_only" })).rejects.toThrow("not configured");
  });

  it("uses the CJ server token and maps a private job to a create-only order payload", async () => {
    process.env.CJ_DROPSHIPPING_API_KEY = "cj-test-key";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: true, data: { accessToken: "access-token", accessTokenExpiryDate: "2099-01-01T00:00:00.000Z" } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 200, result: true, requestId: "cj-request", data: { orderId: "cj-order" } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { createCjOrder } = await import("./cjDropshipping");

    await expect(createCjOrder({ orderNumber: "AC-TEST", externalSkuId: "CJ-001", quantity: 2, buyerName: "Ada Okafor", buyerPhone: "08000000000", state: "Lagos", lga: "Ikeja", streetDetails: "12 Oyan Road", logisticsName: "CJPacket", fromCountryCode: "CN", orderMode: "create_only" })).resolves.toEqual({ orderId: "cj-order", requestId: "cj-request" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const orderRequest = fetchMock.mock.calls[1];
    expect(orderRequest[1].headers).toMatchObject({ "CJ-Access-Token": "access-token" });
    expect(JSON.parse(orderRequest[1].body)).toMatchObject({ orderNumber: "AC-TEST", shippingCountryCode: "NG", shippingProvince: "Lagos", shippingCity: "Ikeja", payType: 3, products: [{ sku: "CJ-001", quantity: 2, storeLineItemId: "AC-TEST-CJ-001" }] });
  });

  it("marks a CJ validation response as a non-retryable error", async () => {
    process.env.CJ_DROPSHIPPING_API_KEY = "cj-test-key";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: true, data: { accessToken: "access-token", accessTokenExpiryDate: "2099-01-01T00:00:00.000Z" } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ code: 1600100, result: false, message: "Param error" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { createCjOrder, CjDropshippingError } = await import("./cjDropshipping");
    await expect(createCjOrder({ orderNumber: "AC-TEST", externalSkuId: "CJ-001", quantity: 1, buyerName: "Ada Okafor", buyerPhone: "08000000000", state: "Lagos", lga: "Ikeja", streetDetails: "12 Oyan Road", logisticsName: "CJPacket", fromCountryCode: "CN", orderMode: "create_only" })).rejects.toMatchObject({ constructor: CjDropshippingError, retryable: false });
  });
});
