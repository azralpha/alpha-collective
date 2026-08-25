import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createOrder: vi.fn(),
  createReferralShare: vi.fn(),
  createVendorApplication: vi.fn(),
  createVendorProduct: vi.fn(),
  getKycProfileForUser: vi.fn(),
  getReferralShareByCode: vi.fn(),
  getReferralShareByRewardCode: vi.fn(),
  getVendorApplicationForUser: vi.fn(),
  getVendorProductForApplication: vi.fn(),
  listAdminReviewProducts: vi.fn(),
  listActiveOfficialProducts: vi.fn(),
  listApprovedVendorProducts: vi.fn(),
  listReferralSharesForUser: vi.fn(),
  listVendorProducts: vi.fn(),
  qualifyReferralShare: vi.fn(),
  redeemReferralReward: vi.fn(),
  storagePut: vi.fn(),
  storeProcessedProductImage: vi.fn(),
  updateVendorProductStatus: vi.fn(),
  updateVendorDraftProduct: vi.fn(),
}));

vi.mock("../db", () => mocks);
vi.mock("../storage", () => ({ storagePut: mocks.storagePut }));
vi.mock("../productImageProcessing", async importOriginal => {
  const actual = await importOriginal<typeof import("../productImageProcessing")>();
  return { ...actual, storeProcessedProductImage: mocks.storeProcessedProductImage };
});

import { marketplaceRouter } from "./marketplace";

const application = {
  id: 31,
  userId: 7,
  name: "Vendor",
  storeName: "Test Store",
  whatsapp: "08000000000",
  category: "Fashion" as const,
  status: "pending" as const,
  commissionRate: 12,
  createdAt: new Date(),
};

function caller() {
  return marketplaceRouter.createCaller({ user: { id: 7 } } as never);
}

function adminCaller() {
  return marketplaceRouter.createCaller({ user: { id: 1, role: "admin" } } as never);
}

describe("marketplace vendor image workflow", () => {
  beforeEach(() => {
    mocks.listActiveOfficialProducts.mockResolvedValue([]);
  });

  it("rejects unsupported primary-image payloads before storage", async () => {
    await expect(caller().vendor.uploadProductImage({ dataUrl: "data:text/plain;base64,SGVsbG8=" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.storagePut).not.toHaveBeenCalled();
  });

  it("blocks non-administrators from importing CJ catalogue details", async () => {
    await expect(caller().admin.importCjProduct({ sku: "CJ-001" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("stores uploaded product images and persists their ordered gallery with the draft", async () => {
    mocks.getVendorApplicationForUser.mockResolvedValue(application);
    mocks.storeProcessedProductImage.mockResolvedValue({ key: "vendor-products/7/product_123.webp", url: "/manus-storage/vendor-products/7/product_123.webp" });
    mocks.createVendorProduct.mockResolvedValue(91);
    const dataUrl = `data:image/png;base64,${Buffer.from("image-bytes").toString("base64")}`;

    const uploaded = await caller().vendor.uploadProductImage({ dataUrl });
    const additionalImage = "/manus-storage/vendor-products/7/product_456.jpg";
    await caller().vendor.createProduct({
      title: "Image-backed draft",
      category: "Fashion",
      price: 4500,
      description: "A product draft with a primary image.",
      imageUrls: [uploaded.imageUrl, additionalImage],
    });

    expect(mocks.storeProcessedProductImage).toHaveBeenCalledWith(expect.objectContaining({ storagePrefix: expect.stringMatching(/^vendor-products\/7\//) }));
    expect(mocks.createVendorProduct).toHaveBeenCalledWith(expect.objectContaining({
      vendorApplicationId: 31,
      imageUrl: "/manus-storage/vendor-products/7/product_123.webp",
      imageUrls: ["/manus-storage/vendor-products/7/product_123.webp", "/manus-storage/vendor-products/7/product_456.jpg"],
      status: "draft",
    }));
  });

  it("maps active vendor products with persisted galleries for the public catalogue", async () => {
    mocks.listApprovedVendorProducts.mockResolvedValue([{
      id: 91,
      title: "Approved image find",
      category: "Fashion",
      price: 4500,
      description: "Approved for public category pages.",
      imageUrl: "/manus-storage/vendor-products/7/product_123.jpg",
      imageUrls: ["/manus-storage/vendor-products/7/product_123.jpg", "/manus-storage/vendor-products/7/product_456.jpg"],
      vendor: "Test Store",
    }]);

    await expect(caller().publicProducts()).resolves.toEqual([expect.objectContaining({
      id: "vendor-91",
      imageUrl: "/manus-storage/vendor-products/7/product_123.jpg",
      imageUrls: ["/manus-storage/vendor-products/7/product_123.jpg", "/manus-storage/vendor-products/7/product_456.jpg"],
      badge: "Verified seller find",
    })]);
  });

  it("calculates a delivery quote from the selected zone, parcel weight, and service tier", async () => {
    await expect(caller().deliveryQuote({ destinationState: "Osun", weightKg: 3, serviceTier: "express" })).resolves.toMatchObject({
      zone: "regional",
      baseRate: 15000,
      weightSurcharge: 1000,
      deliveryFee: 24000,
    });
  });

  it("stores a standardized address and dynamic delivery fee for approved vendor products in the cart", async () => {
    mocks.getKycProfileForUser.mockResolvedValue({ status: "verified" });
    mocks.listApprovedVendorProducts.mockResolvedValue([{
      id: 91,
      title: "Approved image find",
      category: "Fashion",
      price: 4500,
      description: "Approved for public category pages.",
      imageUrl: "/manus-storage/vendor-products/7/product_123.jpg",
      imageUrls: ["/manus-storage/vendor-products/7/product_123.jpg"],
      vendor: "Test Store",
    }]);

    await expect(caller().submitOrder({
      buyerName: "Ada Okafor",
      buyerPhone: "08000000000",
      deliveryAddress: { country: "Nigeria", state: "Lagos", lga: "Ikeja", streetDetails: "12 Oyan Road, Olomoba Compound" },
      packageWeightKg: 3,
      deliveryTier: "express",
      items: [{ productId: "vendor-91", quantity: 2 }],
    })).resolves.toMatchObject({ subtotal: 9000, deliveryFee: 15750, total: 24750 });

    expect(mocks.createOrder).toHaveBeenCalledWith(expect.objectContaining({
      deliveryAddress: "NIGERIA, LAGOS, IKEJA, 12 Oyan Road, Olomoba Compound",
      deliveryFee: 15750,
      total: 24750,
      orderLines: [expect.objectContaining({ productId: "vendor-91", quantity: 2 })],
    }));
  });

  it("allows administrators to review and publish a vendor draft", async () => {
    mocks.listAdminReviewProducts.mockResolvedValue([{ id: 91, productStatus: "draft" }]);
    await expect(adminCaller().admin.reviewProducts()).resolves.toEqual([{ id: 91, productStatus: "draft" }]);
    await expect(adminCaller().admin.setProductStatus({ id: 91, status: "active" })).resolves.toEqual({ id: 91, status: "active" });
    expect(mocks.updateVendorProductStatus).toHaveBeenCalledWith(91, "active");
  });

  it("allows a seller to edit only their own draft and retain its gallery when no replacements are sent", async () => {
    mocks.getVendorApplicationForUser.mockResolvedValue(application);
    mocks.getVendorProductForApplication.mockResolvedValue({ id: 91, status: "draft", imageUrl: "/manus-storage/vendor-products/7/product_123.jpg", imageUrls: ["/manus-storage/vendor-products/7/product_123.jpg"] });
    await expect(caller().vendor.updateDraftProduct({ id: 91, title: "Updated draft", category: "Fashion", price: 5000, description: "An updated product draft description." })).resolves.toEqual({ id: 91, status: "draft" });
    expect(mocks.updateVendorDraftProduct).toHaveBeenCalledWith(91, expect.objectContaining({ title: "Updated draft", imageUrls: ["/manus-storage/vendor-products/7/product_123.jpg"] }));
  });

  it("allows a seller to replace the complete image gallery on their own draft", async () => {
    mocks.getVendorApplicationForUser.mockResolvedValue(application);
    mocks.getVendorProductForApplication.mockResolvedValue({ id: 91, status: "draft", imageUrl: "/manus-storage/vendor-products/7/product_123.jpg", imageUrls: ["/manus-storage/vendor-products/7/product_123.jpg"] });
    const replacementGallery = ["/manus-storage/vendor-products/7/replacement_1.jpg", "/manus-storage/vendor-products/7/replacement_2.jpg"];
    await expect(caller().vendor.updateDraftProduct({ id: 91, title: "Updated draft", category: "Fashion", price: 5000, description: "An updated product draft description.", imageUrls: replacementGallery })).resolves.toEqual({ id: 91, status: "draft" });
    expect(mocks.updateVendorDraftProduct).toHaveBeenCalledWith(91, expect.objectContaining({ imageUrl: replacementGallery[0], imageUrls: replacementGallery }));
  });

  it("blocks edits to published products", async () => {
    mocks.getVendorApplicationForUser.mockResolvedValue(application);
    mocks.getVendorProductForApplication.mockResolvedValue({ id: 91, status: "active", imageUrl: "/manus-storage/vendor-products/7/product_123.jpg", imageUrls: ["/manus-storage/vendor-products/7/product_123.jpg"] });
    await expect(caller().vendor.updateDraftProduct({ id: 91, title: "Published find", category: "Fashion", price: 5000, description: "A published product cannot be edited here." })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
