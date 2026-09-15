import { describe, expect, it } from "vitest";
import { CJ_MASS_IMPORT_MAX_SKUS, getCjMassImportSkuEntries, isValidCjMassImportSize } from "./cjMassImportInput";

describe("CJ mass-import input", () => {
  it("normalizes comma and multiline SKU entries while retaining first-seen order", () => {
    expect(getCjMassImportSkuEntries(" cjnssywy01847, CJ-002\nCJNSSYWY01847 \n\n cj-003")).toEqual([
      "CJNSSYWY01847",
      "CJ-002",
      "CJ-003",
    ]);
  });

  it("accepts one through fifty unique SKUs and rejects empty or oversized batches", () => {
    expect(isValidCjMassImportSize("CJ-001")).toBe(true);
    expect(isValidCjMassImportSize(Array.from({ length: CJ_MASS_IMPORT_MAX_SKUS }, (_, index) => `CJ-${index + 1}`).join("\n"))).toBe(true);
    expect(isValidCjMassImportSize("")).toBe(false);
    expect(isValidCjMassImportSize(Array.from({ length: CJ_MASS_IMPORT_MAX_SKUS + 1 }, (_, index) => `CJ-${index + 1}`).join(","))).toBe(false);
  });
});
