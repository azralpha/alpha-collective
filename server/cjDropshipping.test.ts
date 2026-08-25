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

  it("fetches a matching CJ SKU for an unpublished draft without creating a supplier order", async () => {
    process.env.CJ_DROPSHIPPING_API_KEY = "cj-test-key";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: true, data: { accessToken: "access-token", accessTokenExpiryDate: "2099-01-01T00:00:00.000Z" } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: true, data: { content: [{ productList: [{ sku: "CJ-001", nameEn: "Portable Desk Fan", nowPrice: "9.50", bigImage: "https://cc-west-usa.oss-us-west-1.aliyuncs.com/fan.png", description: "<p>Quiet <b>portable</b> desk fan for everyday cooling.</p>" }] }] } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { fetchCjProductForImport } = await import("./cjDropshipping");

    await expect(fetchCjProductForImport("cj-001")).resolves.toMatchObject({ sku: "CJ-001", title: "Portable Desk Fan", description: "Quiet portable desk fan for everyday cooling.", supplierCost: 9.5, supplierCurrency: "USD", imageUrls: ["https://cc-west-usa.oss-us-west-1.aliyuncs.com/fan.png"] });
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("/product/listV2?");
    expect(String(fetchMock.mock.calls[1]?.[0])).not.toContain("createOrder");
  });

  it("accepts a CJ SPU when the catalogue response has a distinct fulfilment SKU", async () => {
    process.env.CJ_DROPSHIPPING_API_KEY = "cj-test-key";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: true, data: { accessToken: "access-token", accessTokenExpiryDate: "2099-01-01T00:00:00.000Z" } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: true, data: { content: [{ productList: [{ sku: "CJYH247507812LO-RED", spu: "CJYH247507812LO", nameEn: "CJ SPU Import", nowPrice: "12.00", bigImage: "https://cc-west-usa.oss-us-west-1.aliyuncs.com/item.png", description: "<p>Imported product detail text.</p>" }] }] } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { fetchCjProductForImport } = await import("./cjDropshipping");

    await expect(fetchCjProductForImport("cjyh247507812lo")).resolves.toMatchObject({ sku: "CJYH247507812LO-RED", title: "CJ SPU Import", supplierCost: 12 });
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain("size=100");
    expect(String(fetchMock.mock.calls[1]?.[0])).not.toContain("createOrder");
  });

  it("falls back to CJ's exact productSku listing endpoint when V2 search omits a valid identifier", async () => {
    process.env.CJ_DROPSHIPPING_API_KEY = "cj-test-key";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: true, data: { accessToken: "access-token", accessTokenExpiryDate: "2099-01-01T00:00:00.000Z" } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: true, data: { content: [{ productList: [] }] } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: true, data: { list: [{ productSku: "CJYH247507812LO", productNameEn: "Fallback CJ Product", productImage: "https://cc-west-usa.oss-us-west-1.aliyuncs.com/fallback.png", sellPrice: 15.5 }] } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { fetchCjProductForImport } = await import("./cjDropshipping");

    await expect(fetchCjProductForImport("CJYH247507812LO")).resolves.toMatchObject({ sku: "CJYH247507812LO", title: "Fallback CJ Product", supplierCost: 15.5, supplierCurrency: "USD" });
    expect(String(fetchMock.mock.calls[2]?.[0])).toContain("/product/list?pageNum=1&pageSize=20&productSku=CJYH247507812LO");
    expect(String(fetchMock.mock.calls[2]?.[0])).not.toContain("createOrder");
  });

  it("resolves a unique CJ parent SPU for a longer variant-style product identifier without placing an order", async () => {
    process.env.CJ_DROPSHIPPING_API_KEY = "cj-test-key";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: true, data: { accessToken: "access-token", accessTokenExpiryDate: "2099-01-01T00:00:00.000Z" } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: true, data: { content: [{ productList: [{ sku: "CJYH2475078", spu: "CJYH2475078", nameEn: "CJ Parent Product", nowPrice: "18.25", bigImage: "https://cc-west-usa.oss-us-west-1.aliyuncs.com/parent.png", description: "<p>Parent item for the CJ variant selection.</p>" }] }] } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { fetchCjProductForImport } = await import("./cjDropshipping");

    await expect(fetchCjProductForImport("CJYH247507812LO")).resolves.toMatchObject({ sku: "CJYH2475078", title: "CJ Parent Product", matchType: "parent_spu", supplierCost: 18.25 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1]?.[0])).not.toContain("createOrder");
  });

  it("imports a draft with a formatted price and leaves an ambiguous price blank for administrator review", async () => {
    process.env.CJ_DROPSHIPPING_API_KEY = "cj-test-key";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: true, data: { accessToken: "access-token", accessTokenExpiryDate: "2099-01-01T00:00:00.000Z" } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: true, data: { content: [{ productList: [{ sku: "CJ-FORMATTED", nameEn: "Formatted Price Product", nowPrice: "N/A", sellPrice: "US $ 12.50", bigImage: "https://cc-west-usa.oss-us-west-1.aliyuncs.com/formatted.png", description: "<p>Formatted supplier price product.</p>" }] }] } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { fetchCjProductForImport } = await import("./cjDropshipping");
    await expect(fetchCjProductForImport("CJ-FORMATTED")).resolves.toMatchObject({ supplierCost: 12.5, supplierCostAvailable: true });

    vi.resetModules();
    const ambiguousFetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: true, data: { accessToken: "access-token", accessTokenExpiryDate: "2099-01-01T00:00:00.000Z" } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: true, data: { content: [{ productList: [{ sku: "CJ-RANGE", nameEn: "Range Price Product", nowPrice: "USD 8.00 - 12.00", bigImage: "https://cc-west-usa.oss-us-west-1.aliyuncs.com/range.png", description: "<p>Range supplier price product.</p>" }] }] } }), { status: 200 }));
    vi.stubGlobal("fetch", ambiguousFetch);
    const { fetchCjProductForImport: importAmbiguousPrice } = await import("./cjDropshipping");
    await expect(importAmbiguousPrice("CJ-RANGE")).resolves.toMatchObject({ supplierCost: null, supplierCostAvailable: false, title: "Range Price Product" });
    expect(String(ambiguousFetch.mock.calls[1]?.[0])).not.toContain("createOrder");
  });

  it("reads available variant inventory and a Nigeria freight quote for a landed-cost draft without creating an order", async () => {
    process.env.CJ_DROPSHIPPING_API_KEY = "cj-test-key";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: true, data: { accessToken: "access-token", accessTokenExpiryDate: "2099-01-01T00:00:00.000Z" } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: true, data: { content: [{ productList: [{ sku: "CJ-LANDED", nameEn: "Landed Cost Product", sellPrice: "15.25", bigImage: "https://cc-west-usa.oss-us-west-1.aliyuncs.com/landed.png", description: "<p>Inventory and shipping test product.</p>" }] }] } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: true, data: { pid: "cj-product-id", sellPrice: 15.25, variants: [{ vid: "cj-variant-id", variantSku: "CJ-LANDED-BLUE", variantSellPrice: 15.25, inventories: [{ countryCode: "CN", totalInventory: 17 }] }] } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: true, data: [{ logisticPrice: 4.75 }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { fetchCjProductForMassImport } = await import("./cjDropshipping");

    await expect(fetchCjProductForMassImport("CJ-LANDED")).resolves.toMatchObject({ sku: "CJ-LANDED-BLUE", externalProductId: "cj-product-id", externalVariantId: "cj-variant-id", stockQuantity: 17, inventoryCountryCode: "CN", supplierProductCost: 15.25, supplierShippingCost: 4.75, supplierCost: 20 });
    expect(JSON.parse(fetchMock.mock.calls[3]?.[1].body)).toEqual({ startCountryCode: "CN", endCountryCode: "NG", products: [{ quantity: 1, vid: "cj-variant-id" }] });
    expect(fetchMock.mock.calls.map(call => String(call[0])).join(" ")).not.toContain("createOrder");
  });

  it("returns a zero stock snapshot when CJ no longer reports the mapped variant as available", async () => {
    process.env.CJ_DROPSHIPPING_API_KEY = "cj-test-key";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: true, data: { accessToken: "access-token", accessTokenExpiryDate: "2099-01-01T00:00:00.000Z" } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: true, data: { pid: "cj-product-id", variants: [{ vid: "cj-variant-id", variantSku: "CJ-LANDED-BLUE", inventories: [{ countryCode: "CN", totalInventory: 0 }] }] } }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { fetchCjInventorySnapshot } = await import("./cjDropshipping");

    await expect(fetchCjInventorySnapshot({ productSku: "CJ-LANDED", preferredVariantId: "cj-variant-id" })).resolves.toEqual({ externalProductId: "cj-product-id", externalVariantId: "cj-variant-id", stockQuantity: 0, inventoryCountryCode: null });
    expect(String(fetchMock.mock.calls[1]?.[0])).not.toContain("createOrder");
  });
});
