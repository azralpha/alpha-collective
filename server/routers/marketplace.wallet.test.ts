import { beforeEach, describe, expect, it, vi } from "vitest";
import { MARKETPLACE_PRODUCTS } from "../../shared/marketplace";
import { hashTransactionPin } from "../walletSecurity";

const mocks = vi.hoisted(() => ({
  createWalletEscrowOrder: vi.fn(),
  getWalletForUser: vi.fn(),
  listActiveOfficialProducts: vi.fn(),
  listActiveOfficialProductsWithSourcing: vi.fn(),
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
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.listActiveOfficialProducts.mockResolvedValue([]);
    mocks.listActiveOfficialProductsWithSourcing.mockResolvedValue([]);
  });

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
      message: "Alpha Wallet currently supports approved vendor listings and Alpha Collective Official products only.",
    });
    expect(mocks.createWalletEscrowOrder).not.toHaveBeenCalled();
  });

  it("locks wallet authorization for fifteen minutes on the third incorrect PIN attempt", async () => {
    mocks.getWalletForUser.mockResolvedValue({ id: 8, userId: 7, pinHash: await hashTransactionPin("1234"), pinFailedAttempts: 2, pinLockedUntil: null });

    await expect(buyerCaller().wallet.checkout({ ...checkoutBase, transactionPin: "0000", items: [{ productId: MARKETPLACE_PRODUCTS[0].id, quantity: 1 }] })).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
      message: "Wallet PIN is locked for 15 minutes after three failed attempts.",
    });
    expect(mocks.recordWalletPinFailure).toHaveBeenCalledWith(7, 3, expect.any(Date));
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

  it("creates a private CJ fulfilment job snapshot for an eligible Alpha Collective Official wallet order", async () => {
    mocks.getWalletForUser.mockResolvedValue({ id: 8, userId: 7, pinHash: await hashTransactionPin("1234"), pinFailedAttempts: 0, pinLockedUntil: null });
    mocks.listApprovedVendorProducts.mockResolvedValue([]);
    mocks.listActiveOfficialProductsWithSourcing.mockResolvedValue([{ id: 21, title: "Official travel bag", category: "Fashion", price: 18_500, formerPrice: null, badge: null, description: "A white-labeled official product for customer checkout.", detail: "A product detail suitable for the official catalogue.", imageUrl: "/manus-storage/official-products/1/bag.jpg", imageUrls: ["/manus-storage/official-products/1/bag.jpg"], fulfillmentProvider: "auto_fulfill_api", externalSkuId: "CJ-BAG-001" }]);
    mocks.createWalletEscrowOrder.mockResolvedValue({});

    await expect(buyerCaller().wallet.checkout({ ...checkoutBase, items: [{ productId: "official-21", quantity: 2 }] })).resolves.toMatchObject({ paymentStatus: "wallet_escrow" });
    expect(mocks.createWalletEscrowOrder).toHaveBeenCalledWith(expect.objectContaining({
      fulfilmentJobInputs: [expect.objectContaining({ officialProductId: 21, provider: "cj_dropshipping", externalSkuSnapshot: "CJ-BAG-001", quantity: 2, deliverySnapshot: expect.objectContaining({ countryCode: "NG", state: "Lagos", lga: "Ikeja" }) })],
    }));
  });

  it("returns only white-label catalog fields for an official product and omits all sourcing metadata", async () => {
    mocks.listApprovedVendorProducts.mockResolvedValue([]);
    mocks.listActiveOfficialProducts.mockResolvedValue([{ id: 21, title: "Official travel bag", category: "Fashion", price: 18_500, formerPrice: null, badge: null, description: "A white-labeled official product for customer checkout.", detail: "A product detail suitable for the official catalogue.", imageUrl: "/manus-storage/official-products/1/bag.jpg", imageUrls: ["/manus-storage/official-products/1/bag.jpg"] }]);

    const results = await marketplaceRouter.createCaller({} as never).publicProducts();
    expect(results[0]).toMatchObject({ id: "official-21", vendor: "Alpha Collective Official" });
    expect(results[0]).not.toHaveProperty("externalSkuId");
    expect(results[0]).not.toHaveProperty("supplierCost");
    expect(results[0]).not.toHaveProperty("fulfillmentProvider");
  });
});
