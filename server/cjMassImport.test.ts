import { describe, expect, it } from "vitest";
import { calculateMassImportNairaPrice, normalizeCjSkuList } from "./cjMassImport";

describe("CJ mass import safeguards", () => {
  it("normalizes comma and line-break SKU input while removing duplicates", () => {
    expect(normalizeCjSkuList(" cj-one, CJ-TWO\nCJ-one \nCJ_THREE ")).toEqual(["CJ-ONE", "CJ-TWO", "CJ_THREE"]);
  });

  it("rejects malformed or unbounded SKU batches", () => {
    expect(() => normalizeCjSkuList("bad sku with spaces")).toThrow("valid CJ SKU");
    expect(() => normalizeCjSkuList(Array.from({ length: 51 }, (_, index) => `CJ-${index + 100}`).join(","))).toThrow("up to 50");
  });

  it("calculates a rounded Naira draft price from landed USD cost and markup", () => {
    expect(calculateMassImportNairaPrice({ landedUsdCost: 10, exchangeRateNgnPerUsd: 1_500, markupPercent: 50 })).toBe(22_500);
  });

  it("fails closed when pricing inputs would produce an unsafe draft price", () => {
    expect(() => calculateMassImportNairaPrice({ landedUsdCost: 1, exchangeRateNgnPerUsd: 100, markupPercent: 0 })).toThrow("unsafe Naira price");
  });
});
