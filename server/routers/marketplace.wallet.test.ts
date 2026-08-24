import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  releaseWalletEscrowOrder: vi.fn(),
}));

vi.mock("../db", () => mocks);

import { marketplaceRouter } from "./marketplace";

function adminCaller() {
  return marketplaceRouter.createCaller({ user: { id: 1, role: "admin" } } as never);
}

describe("marketplace wallet escrow release", () => {
  beforeEach(() => vi.resetAllMocks());

  it("releases a held wallet order once and reports vendor allocations", async () => {
    mocks.releaseWalletEscrowOrder.mockResolvedValue({ releasedVendors: [{ userId: 42, amount: 15_000 }] });

    await expect(adminCaller().admin.markWalletOrderDelivered({ reference: "AC-WALLET-001" })).resolves.toEqual({
      reference: "AC-WALLET-001",
      releasedVendors: [{ userId: 42, amount: 15_000 }],
    });
    expect(mocks.releaseWalletEscrowOrder).toHaveBeenCalledTimes(1);
  });

  it("rejects a second delivery-release attempt after the held escrow state has changed", async () => {
    mocks.releaseWalletEscrowOrder.mockRejectedValue(new Error("This order does not have held wallet escrow."));

    await expect(adminCaller().admin.markWalletOrderDelivered({ reference: "AC-WALLET-001" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "This order does not have held wallet escrow.",
    });
  });
});
