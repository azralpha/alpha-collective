import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({
  creditVerifiedWalletFunding: vi.fn(),
  getWalletFundingAttemptByReference: vi.fn(),
  markWalletWithdrawalPaid: vi.fn(),
  reverseWalletWithdrawal: vi.fn(),
}));

vi.mock("./paystack", async importOriginal => {
  const actual = await importOriginal<typeof import("./paystack")>();
  return { ...actual, verifyPaystackTransaction: vi.fn() };
});

import { creditVerifiedWalletFunding, getWalletFundingAttemptByReference, markWalletWithdrawalPaid, reverseWalletWithdrawal } from "./db";
import { verifyPaystackTransaction } from "./paystack";
import { processPaystackWebhook } from "./paystackWebhook";

describe("Paystack webhook reconciliation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("verifies a successful funding transaction before requesting an idempotent wallet credit", async () => {
    vi.mocked(getWalletFundingAttemptByReference).mockResolvedValue({ amount: 12_500 } as never);
    vi.mocked(verifyPaystackTransaction).mockResolvedValue({ id: "991", reference: "acwfund_123", status: "success", amountKobo: 1_250_000 });

    await processPaystackWebhook({ event: "charge.success", data: { reference: "acwfund_123" } });

    expect(verifyPaystackTransaction).toHaveBeenCalledWith("acwfund_123");
    expect(creditVerifiedWalletFunding).toHaveBeenCalledWith({ reference: "acwfund_123", providerTransactionId: "991" });
  });

  it("does not attempt an external transaction verification for an unknown funding reference", async () => {
    vi.mocked(getWalletFundingAttemptByReference).mockResolvedValue(undefined);

    await processPaystackWebhook({ event: "charge.success", data: { reference: "unknown_reference" } });

    expect(verifyPaystackTransaction).not.toHaveBeenCalled();
    expect(creditVerifiedWalletFunding).not.toHaveBeenCalled();
  });

  it("routes failed and reversed transfer events to the single idempotent balance-restoration path", async () => {
    await processPaystackWebhook({ event: "transfer.failed", data: { reference: "acwwith_456", transfer_code: "TRF_1" } });
    await processPaystackWebhook({ event: "transfer.reversed", data: { reference: "acwwith_789", transfer_code: "TRF_2" } });

    expect(reverseWalletWithdrawal).toHaveBeenNthCalledWith(1, { reference: "acwwith_456", outcome: "failed", providerTransferCode: "TRF_1" });
    expect(reverseWalletWithdrawal).toHaveBeenNthCalledWith(2, { reference: "acwwith_789", outcome: "reversed", providerTransferCode: "TRF_2" });
    expect(markWalletWithdrawalPaid).not.toHaveBeenCalled();
  });

  it("marks only a successful transfer as paid", async () => {
    await processPaystackWebhook({ event: "transfer.success", data: { reference: "acwwith_987", transfer_code: "TRF_3" } });
    expect(markWalletWithdrawalPaid).toHaveBeenCalledWith({ reference: "acwwith_987", providerTransferCode: "TRF_3" });
  });
});
