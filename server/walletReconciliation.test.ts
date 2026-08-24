import { describe, expect, it } from "vitest";
import { fundingCreditDisposition, withdrawalPaidDisposition, withdrawalRestoreDisposition } from "./walletReconciliation";

describe("wallet reconciliation idempotency gates", () => {
  it("permits a Paystack funding credit only while its durable attempt remains pending", () => {
    expect(fundingCreditDisposition("pending")).toBe("credit");
    expect(fundingCreditDisposition("succeeded")).toBe("ignore_duplicate");
    expect(fundingCreditDisposition("failed")).toBe("reject");
  });

  it("allows a payout outcome once and ignores duplicate success, failure, or reversal events", () => {
    expect(withdrawalPaidDisposition("pending")).toBe("mark_paid");
    expect(withdrawalPaidDisposition("processing")).toBe("mark_paid");
    expect(withdrawalPaidDisposition("paid")).toBe("ignore_duplicate");
    expect(withdrawalRestoreDisposition("pending")).toBe("restore");
    expect(withdrawalRestoreDisposition("processing")).toBe("restore");
    expect(withdrawalRestoreDisposition("failed")).toBe("ignore_duplicate");
    expect(withdrawalRestoreDisposition("reversed")).toBe("ignore_duplicate");
    expect(withdrawalRestoreDisposition("paid")).toBe("ignore_duplicate");
  });
});
