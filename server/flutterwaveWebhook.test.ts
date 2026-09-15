import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({ creditVerifiedWalletFunding: vi.fn(), getWalletFundingAttemptByReference: vi.fn() }));
vi.mock("./flutterwave", async importOriginal => {
  const actual = await importOriginal<typeof import("./flutterwave")>();
  return { ...actual, verifyFlutterwaveTransaction: vi.fn() };
});

import { creditVerifiedWalletFunding, getWalletFundingAttemptByReference } from "./db";
import { verifyFlutterwaveTransaction } from "./flutterwave";
import { processFlutterwaveWebhook } from "./flutterwaveWebhook";

describe("Flutterwave webhook reconciliation", () => {
  beforeEach(() => vi.resetAllMocks());

  it("credits only an independently verified matching NGN funding attempt", async () => {
    vi.mocked(getWalletFundingAttemptByReference).mockResolvedValue({ amount: 12_500, provider: "flutterwave" } as never);
    vi.mocked(verifyFlutterwaveTransaction).mockResolvedValue({ id: "445", reference: "acfwfund_123", status: "successful", amountNaira: 12_500, currency: "NGN" });

    await processFlutterwaveWebhook({ type: "charge.completed", data: { id: "445" } });

    expect(verifyFlutterwaveTransaction).toHaveBeenCalledWith("445");
    expect(creditVerifiedWalletFunding).toHaveBeenCalledWith({ reference: "acfwfund_123", providerTransactionId: "445", provider: "flutterwave" });
  });

  it("rejects a verified event with the wrong provider, status, currency, or amount", async () => {
    vi.mocked(getWalletFundingAttemptByReference).mockResolvedValue({ amount: 12_500, provider: "paystack" } as never);
    vi.mocked(verifyFlutterwaveTransaction).mockResolvedValue({ id: "445", reference: "acfwfund_123", status: "successful", amountNaira: 12_500, currency: "NGN" });

    await expect(processFlutterwaveWebhook({ type: "charge.completed", data: { id: "445" } })).rejects.toThrow("did not match");
    expect(creditVerifiedWalletFunding).not.toHaveBeenCalled();
  });
});
