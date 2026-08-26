import { beforeEach, describe, expect, it, vi } from "vitest";
import { MARKETPLACE_PRODUCTS } from "../../shared/marketplace";
import { hashTransactionPin } from "../walletSecurity";

const mocks = vi.hoisted(() => ({
  assessReferralFraudBeforeCheckout: vi.fn(),
  createReferralShare: vi.fn(),
  createCryptoFundingAttempt: vi.fn(),
  createOrder: vi.fn(),
  createWalletEscrowOrder: vi.fn(),
  confirmBuyerReceivedWalletOrder: vi.fn(),
  ensureKycProfileForUser: vi.fn(),
  getReferralRewardSettings: vi.fn(),
  getReferralShareByCode: vi.fn(),
  getCurrentVendorCommissionRate: vi.fn(),
  getVendorApplicationForUser: vi.fn(),
  getWalletForUser: vi.fn(),
  isReferralEligibleUser: vi.fn(),
  listActiveOfficialProducts: vi.fn(),
  listActiveOfficialProductsWithSourcing: vi.fn(),
  listApprovedVendorProducts: vi.fn(),
  listBuyerWalletEscrowOrders: vi.fn(),
  markWalletOrderDelivered: vi.fn(),
  recordWalletPinFailure: vi.fn(),
  releaseWalletEscrowOrder: vi.fn(),
  queueReferralBonusAfterDeliveredOrder: vi.fn(),
  queueCashbackAfterDeliveredOrder: vi.fn(),
  queueVerifiedPostSaleBonus: vi.fn(),
  resetWalletPinFailures: vi.fn(),
  ensureWalletForUser: vi.fn(),
  markCryptoFundingAttemptStatus: vi.fn(),
  saveCryptoFundingQuote: vi.fn(),
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
    mocks.ensureKycProfileForUser.mockResolvedValue({ status: "verified" });
    mocks.listBuyerWalletEscrowOrders.mockResolvedValue([]);
    mocks.queueReferralBonusAfterDeliveredOrder.mockResolvedValue({ queued: false, reason: "not_eligible" });
    mocks.queueCashbackAfterDeliveredOrder.mockResolvedValue({ queued: false, reason: "not_delivered" });
    mocks.issueFreeDeliveryVoucherIfQualified = vi.fn().mockResolvedValue({ issued: false, reason: "not_delivered" });
    mocks.isReferralEligibleUser.mockResolvedValue(true);
    mocks.getCurrentVendorCommissionRate.mockResolvedValue(0);
  });

  it("marks a held wallet order delivered without releasing local-vendor escrow", async () => {
    mocks.markWalletOrderDelivered.mockResolvedValue({ reference: "AC-WALLET-001" });

    await expect(adminCaller().admin.markWalletOrderDelivered({ reference: "AC-WALLET-001" })).resolves.toEqual({
      reference: "AC-WALLET-001",
      awaitingBuyerConfirmation: true,
    });
    expect(mocks.markWalletOrderDelivered).toHaveBeenCalledWith("AC-WALLET-001");
    expect(mocks.releaseWalletEscrowOrder).not.toHaveBeenCalled();
  });

  it("releases a delivered local-vendor escrow only after buyer confirmation", async () => {
    mocks.confirmBuyerReceivedWalletOrder.mockResolvedValue({ order: { total: 15_000 }, releasedVendors: [{ userId: 42, amount: 15_000 }] });

    await expect(buyerCaller().wallet.confirmDelivery({ reference: "AC-WALLET-001" })).resolves.toMatchObject({ reference: "AC-WALLET-001", releasedVendors: [{ userId: 42, amount: 15_000 }] });
    expect(mocks.confirmBuyerReceivedWalletOrder).toHaveBeenCalledWith(7, "AC-WALLET-001");
    expect(mocks.queueReferralBonusAfterDeliveredOrder).toHaveBeenCalledWith("AC-WALLET-001");
  });

  it("rejects a second buyer confirmation after escrow state has changed", async () => {
    mocks.confirmBuyerReceivedWalletOrder.mockRejectedValue(new Error("This delivery has already been confirmed or is no longer eligible."));

    await expect(buyerCaller().wallet.confirmDelivery({ reference: "AC-WALLET-001" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "This delivery has already been confirmed or is no longer eligible.",
    });
  });

  it("blocks every wallet procedure before verified KYC", async () => {
    mocks.ensureKycProfileForUser.mockResolvedValue({ status: "identity_pending" });
    await expect(buyerCaller().wallet.dashboard()).rejects.toMatchObject({ code: "PRECONDITION_FAILED", message: "Complete KYC Verification before accessing or using Alpha Wallet." });
    expect(mocks.getWalletForUser).not.toHaveBeenCalled();
  });

  it("reports administrator-only test access as verified without changing the stored KYC profile", async () => {
    mocks.ensureKycProfileForUser.mockResolvedValue({ status: "identity_pending", submittedLegalName: null, verifiedLegalName: null, governmentIdImageUrl: null, failureReason: null });
    mocks.getVendorApplicationForUser.mockResolvedValue(null);

    await expect(adminCaller().kyc.status()).resolves.toMatchObject({ status: "verified", administratorTestAccess: true });
  });

  it("denies a non-administrator before any controlled crypto checkout quote or order can be created", async () => {
    await expect(buyerCaller().wallet.createCryptoCheckoutQuote({ buyerName: "Ada Okafor", buyerPhone: "08000000000", deliveryAddress: checkoutBase.deliveryAddress, packageWeightKg: 1, deliveryTier: "standard", items: [{ productId: MARKETPLACE_PRODUCTS[0].id, quantity: 1 }], payCurrency: "usdttrc20" })).rejects.toMatchObject({ code: "FORBIDDEN", message: "Controlled crypto checkout testing is available to the administrator only." });
    expect(mocks.createOrder).not.toHaveBeenCalled();
    expect(mocks.createCryptoFundingAttempt).not.toHaveBeenCalled();
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

  it("blocks a stock-managed official product when the requested quantity is unavailable", async () => {
    mocks.getWalletForUser.mockResolvedValue({ id: 8, userId: 7, pinHash: await hashTransactionPin("1234"), pinFailedAttempts: 0, pinLockedUntil: null });
    mocks.listApprovedVendorProducts.mockResolvedValue([]);
    mocks.listActiveOfficialProductsWithSourcing.mockResolvedValue([{ id: 22, title: "Official stock-managed bag", category: "Fashion", price: 18_500, formerPrice: null, badge: null, description: "A white-labeled official product for customer checkout.", detail: "A product detail suitable for the official catalogue.", imageUrl: "/manus-storage/official-products/1/bag.jpg", imageUrls: ["/manus-storage/official-products/1/bag.jpg"], stockQuantity: 0, fulfillmentProvider: "auto_fulfill_api", externalSkuId: "CJ-BAG-002" }]);

    await expect(buyerCaller().wallet.checkout({ ...checkoutBase, items: [{ productId: "official-22", quantity: 1 }] })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Official stock-managed bag is currently unavailable in the requested quantity.",
    });
    expect(mocks.createWalletEscrowOrder).not.toHaveBeenCalled();
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

  it("requires verified identity or bank-name matching before a referral link is created", async () => {
    mocks.isReferralEligibleUser.mockResolvedValue(false);

    await expect(buyerCaller().createReferralShare({ channel: "whatsapp" })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "Verify your identity or complete bank-name matching before creating a referral link.",
    });
    expect(mocks.createReferralShare).not.toHaveBeenCalled();
  });

  it("queues a post-sale cashback hold only through the administrator procedure", async () => {
    mocks.queueVerifiedPostSaleBonus.mockResolvedValue({ type: "cashback", amount: 500, releaseAt: new Date("2026-08-27T10:00:00.000Z") });
    await expect(adminCaller().admin.createPostSaleBonus({ reference: "AC-POSTSALE-001", type: "cashback", amount: 500 })).resolves.toMatchObject({ type: "cashback", amount: 500 });
    await expect(buyerCaller().admin.createPostSaleBonus({ reference: "AC-POSTSALE-001", type: "review", amount: 500 })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mocks.queueVerifiedPostSaleBonus).toHaveBeenCalledWith({ reference: "AC-POSTSALE-001", type: "cashback", amount: 500 });
  });

  it("voids a suspicious referral discount without blocking a valid wallet purchase", async () => {
    mocks.getWalletForUser.mockResolvedValue({ id: 8, userId: 7, pinHash: await hashTransactionPin("1234"), pinFailedAttempts: 0, pinLockedUntil: null });
    mocks.listApprovedVendorProducts.mockResolvedValue([{ id: 92, title: "Independent listing", category: "Fashion", price: 7_000, description: "An approved vendor listing for referral safety testing.", imageUrl: "/manus-storage/vendor-products/9/product.jpg", imageUrls: ["/manus-storage/vendor-products/9/product.jpg"], vendor: "Another Store", vendorUserId: 9, commissionRate: 0 }]);
    mocks.getReferralShareByCode.mockResolvedValue({ id: 14, shareCode: "ALPHA-SAFE001", status: "shared", sharerUserId: 12, minimumOrderSubtotal: 5_000, rewardValue: 500 });
    mocks.assessReferralFraudBeforeCheckout.mockResolvedValue({ flagged: true, reason: "same_device" });
    mocks.createWalletEscrowOrder.mockResolvedValue({});

    await expect(buyerCaller().wallet.checkout({ ...checkoutBase, items: [{ productId: "vendor-92", quantity: 1 }], referralCode: "ALPHA-SAFE001" })).resolves.toMatchObject({ discount: 0 });
    expect(mocks.assessReferralFraudBeforeCheckout).toHaveBeenCalledWith({ referralShareId: 14, sharerUserId: 12, referredUserId: 7 });
    expect(mocks.createWalletEscrowOrder).toHaveBeenCalledWith(expect.objectContaining({ order: expect.objectContaining({ referralCode: undefined, referralDiscount: 0, discountType: "none" }) }));
  });

  it("preserves the 0% launch-promo allocation baseline while checking for a current monthly override", async () => {
    mocks.getWalletForUser.mockResolvedValue({ id: 8, userId: 7, pinHash: await hashTransactionPin("1234"), pinFailedAttempts: 0, pinLockedUntil: null });
    mocks.listApprovedVendorProducts.mockResolvedValue([{ id: 94, title: "Launch promo listing", category: "Fashion", price: 6_000, description: "An approved vendor listing for commission reward testing.", imageUrl: "/manus-storage/vendor-products/9/commission.jpg", imageUrls: ["/manus-storage/vendor-products/9/commission.jpg"], vendor: "Another Store", vendorUserId: 9, commissionRate: 12 }]);
    mocks.getCurrentVendorCommissionRate.mockResolvedValue(0);
    mocks.createWalletEscrowOrder.mockResolvedValue({});

    await buyerCaller().wallet.checkout({ ...checkoutBase, items: [{ productId: "vendor-94", quantity: 1 }] });
    expect(mocks.getCurrentVendorCommissionRate).toHaveBeenCalledWith(9, 0);
    expect(mocks.createWalletEscrowOrder).toHaveBeenCalledWith(expect.objectContaining({ allocations: [{ vendorUserId: 9, grossAmount: 6_000, commissionAmount: 0, netAmount: 6_000 }] }));
  });
});
