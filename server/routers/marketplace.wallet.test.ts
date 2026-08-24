import { beforeEach, describe, expect, it, vi } from "vitest";
import { MARKETPLACE_PRODUCTS } from "../../shared/marketplace";
import { hashTransactionPin } from "../walletSecurity";

const mocks = vi.hoisted(() => ({
  createWalletEscrowOrder: vi.fn(),
  getWalletForUser: vi.fn(),
  listApprovedVendorProducts: vi.fn(),
  recordWalletPinFailure: vi.fn(),
  releaseWalletEscrowOrder: vi.fn(),
  resetWalletPinFailures: vi.fn(),
}));

vi.mock("../db", () => mocks);

import { marketplaceRouter } from "./marketplace";

function adminCaller() {
  return marketplaceRouter.createCaller({ user: { id: 1, role: "admin" } } as never);
}

function buyerCaller() {
  return marketplaceRouter.createCaller({ user: { id: 7, role: "user" } } as never);
}

const checkoutBase = {
  buyerName: "Ada Okafor",
  buyerPhone: "08000000000",
  deliveryAddress: { country: "Nigeria" as const, state: "Lagos", lga: "Ikeja", streetDetails: "12 Oyan Road, Olomoba Compound" },
  packageWeightKg: 1,
  deliveryTier: "standard" as const,
  transactionPin: "1234",
};

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

  it("blocks a static catalogue item from entering the wallet escrow path", async () => {
    mocks.getWalletForUser.mockResolvedValue({ id: 8, userId: 7, pinHash: await hashTransactionPin("1234"), pinFailedAttempts: 0, pinLockedUntil: null });
    mocks.listApprovedVendorProducts.mockResolvedValue([]);

    await expect(buyerCaller().wallet.checkout({ ...checkoutBase, items: [{ productId: MARKETPLACE_PRODUCTS[0].id, quantity: 1 }] })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Alpha Wallet currently supports approved vendor listings only.",
    });
    expect(mocks.createWalletEscrowOrder).not.toHaveBeenCalled();
  });

  it("blocks a vendor from using Alpha Wallet to buy their own approved listing", async () => {
    mocks.getWalletForUser.mockResolvedValue({ id: 8, userId: 7, pinHash: await hashTransactionPin("1234"), pinFailedAttempts: 0, pinLockedUntil: null });
    mocks.listApprovedVendorProducts.mockResolvedValue([{ id: 91, title: "Own listing", category: "Fashion", price: 4_500, description: "An approved vendor listing for self-purchase prevention.", imageUrl: "/manus-storage/vendor-products/7/product.jpg", imageUrls: ["/manus-storage/vendor-products/7/product.jpg"], vendor: "Ada Store", vendorUserId: 7, commissionRate: 0 }]);

    await expect(buyerCaller().wallet.checkout({ ...checkoutBase, items: [{ productId: "vendor-91", quantity: 1 }] })).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Use Alpha Wallet to purchase from other vendors, not your own listing.",
    });
    expect(mocks.createWalletEscrowOrder).not.toHaveBeenCalled();
  });
});
