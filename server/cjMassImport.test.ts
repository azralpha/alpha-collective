import { describe, expect, it } from "vitest";
import { calculateMassImportNairaPrice, createSupplierProductIdentity, hasConfirmedPositiveSupplierInventory, normalizeCjSkuList } from "./cjMassImport";
import { normalizeAliExpressProductReference } from "./aliexpressDropship";

describe("supplier mass import safeguards", () => {
  it("normalizes comma and line-break SKU input while removing duplicates", () => {
    expect(normalizeCjSkuList(" cj-one, CJ-TWO\nCJ-one \nCJ_THREE ")).toEqual(["CJ-ONE", "CJ-TWO", "CJ_THREE"]);
  });

  it("rejects malformed or unbounded SKU batches", () => {
    expect(() => normalizeCjSkuList("bad sku with spaces")).toThrow("valid CJ SKU");
    expect(() => normalizeCjSkuList(Array.from({ length: 501 }, (_, index) => `CJ-${index + 100}`).join(","))).toThrow("up to 500");
  });

  it("accepts exactly five hundred normalized SKU or SPU-style entries for one durable draft batch", () => {
    const submitted = Array.from({ length: 500 }, (_, index) => index % 2 === 0 ? ` cjyh${index.toString().padStart(10, "0")} ` : `CJ-VARIANT-${index}`);
    const normalized = normalizeCjSkuList(submitted.join("\n"));
    expect(normalized).toHaveLength(500);
    expect(normalized[0]).toBe("CJYH0000000000");
    expect(normalized[499]).toBe("CJ-VARIANT-499");
  });

  it("normalizes AliExpress IDs from numeric references or item URLs", () => {
    expect(normalizeAliExpressProductReference("1005001234567890")).toBe("1005001234567890");
    expect(normalizeAliExpressProductReference("https://www.aliexpress.com/item/1005001234567890.html")).toBe("1005001234567890");
  });

  it("namespaces deduplication identities by supplier and normalized product ID", () => {
    expect(createSupplierProductIdentity("cj_dropshipping", "cj_dropshipping:CJ-123")).toBe("cj_dropshipping:cj-123");
    expect(createSupplierProductIdentity("aliexpress", "aliexpress:1005001234567890")).toBe("aliexpress:1005001234567890");
    expect(createSupplierProductIdentity("cj_dropshipping", "cj_dropshipping:CJ-123")).not.toBe(createSupplierProductIdentity("aliexpress", "aliexpress:CJ-123"));
  });

  it("calculates a rounded Naira draft price from landed USD cost and markup", () => {
    expect(calculateMassImportNairaPrice({ landedUsdCost: 10, exchangeRateNgnPerUsd: 1_500, markupPercent: 50 })).toBe(22_500);
  });

  it("calculates the screenshot-selected price using 5% markup and ₦1,400 per USD", () => {
    expect(calculateMassImportNairaPrice({ landedUsdCost: 10, exchangeRateNgnPerUsd: 1_400, markupPercent: 5 })).toBe(14_700);
  });

  it("requires explicitly confirmed positive supplier inventory for activation eligibility", () => {
    expect(hasConfirmedPositiveSupplierInventory(true, 1)).toBe(true);
    expect(hasConfirmedPositiveSupplierInventory(true, 0)).toBe(false);
    expect(hasConfirmedPositiveSupplierInventory(false, 20)).toBe(false);
    expect(hasConfirmedPositiveSupplierInventory(true, null)).toBe(false);
    expect(hasConfirmedPositiveSupplierInventory(true, 1.5)).toBe(false);
  });

  it("fails closed when pricing inputs would produce an unsafe draft price", () => {
    expect(() => calculateMassImportNairaPrice({ landedUsdCost: 1, exchangeRateNgnPerUsd: 100, markupPercent: 0 })).toThrow("unsafe Naira price");
  });
});
