import { describe, expect, it } from "vitest";
import { isCjDropshippingConfigured, validateCjDropshippingCredential } from "./cjDropshipping";

describe("CJ Dropshipping credential", () => {
  it("obtains a read-only access token without creating a supplier order", async () => {
    expect(isCjDropshippingConfigured()).toBe(true);
    await expect(validateCjDropshippingCredential()).resolves.toBe(true);
  }, 20_000);
});
