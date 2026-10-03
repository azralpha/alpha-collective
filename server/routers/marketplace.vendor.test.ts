import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createOrder: vi.fn(),
  createReferralShare: vi.fn(),
  createVendorApplication: vi.fn(),
  createVendorProduct: vi.fn(),
  ensureKycProfileForUser: vi.fn(),
  getKycProfileForUser: vi.fn(),
  getOfficialProductForGeminiEnhancement: vi.fn(),
  getReferralShareByCode: vi.fn(),
  getReferralShareByRewardCode: vi.fn(),
  getVendorApplicationForUser: vi.fn(),
  getVendorProductForApplication: vi.fn(),
  listAdminOfficialProducts: vi.fn(),
  listAdminReviewProducts: vi.fn(),
  listActiveOfficialProducts: vi.fn(),
  listApprovedVendorProducts: vi.fn(),
  listReferralSharesForUser: vi.fn(),
  listVendorProducts: vi.fn(),
  qualifyReferralShare: vi.fn(),
  redeemReferralReward: vi.fn(),
  storagePut: vi.fn(),
  storeProcessedProductImage: vi.fn(),
  generateGeminiProductEnhancement: vi.fn(),
  tryGenerateGeminiProductEnhancement: vi.fn(),
  saveOfficialProductGeminiEnhancement: vi.fn(),
  updateVendorProductStatus: vi.fn(),
  updateVendorDraftProduct: vi.fn(),
}));

vi.mock("../db", () => mocks);
vi.mock("../storage", () => ({ storagePut: mocks.storagePut }));
vi.mock("../geminiProductEnhancer", () => ({ generateGeminiProductEnhancement: mocks.generateGeminiProductEnhancement, tryGenerateGeminiProductEnhancement: mocks.tryGenerateGeminiProductEnhancement }));
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
    mocks.ensureKycProfileForUser.mockResolvedValue({ status: "identity_pending", governmentIdImageUrl: null });
  });

  it("rejects unsupported primary-image payloads before storage", async () => {
    await expect(caller().vendor.uploadProductImage({ dataUrl: "data:text/plain;base64,SGVsbG8=" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(mocks.storagePut).not.toHaveBeenCalled();
  });

  it("blocks non-administrators from importing CJ catalogue details", async () => {
    await expect(caller().admin.importCjProduct({ sku: "CJ-001" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("blocks non-administrators from requesting Gemini product enhancements", async () => {
    await expect(caller().admin.generateGeminiProductEnhancement({ title: "Pocket Blender", description: "A compact blender for quick drinks at home." })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("persists validated Gemini fields for an administrator without publishing or changing pricing", async () => {
    const enhancement = { cleanTitle: "Pocket Blend Mini", seoDescription: "A compact blender for quick drinks at home. Its portable form keeps everyday blending simple.", metaDescription: "A compact portable blender for quick drinks at home, available on Alpha Market.", suggestedTags: ["blender", "portable", "kitchen", "smoothie", "drinkware"] };
    mocks.getOfficialProductForGeminiEnhancement.mockResolvedValue({ id: 81, title: "Raw supplier blender", description: "A compact blender for quick drinks at home.", detail: "Portable USB blender.", status: "draft" });
    mocks.generateGeminiProductEnhancement.mockResolvedValue(enhancement);

    await expect(adminCaller().admin.enhanceOfficialProductWithGemini({ id: 81 })).resolves.toEqual({ id: 81, status: "draft", enhancement });
    expect(mocks.saveOfficialProductGeminiEnhancement).toHaveBeenCalledWith(81, enhancement);
  });

  it("stores uploaded product images and persists their ordered gallery with the draft", async () => {
    mocks.getVendorApplicationForUser.mockResolvedValue(application);
    mocks.storeProcessedProductImage.mockResolvedValue({ key: "vendor-products/7/product_123.webp", url: "/uploads/vendor-products/7/product_123.webp" });
    mocks.createVendorProduct.mockResolvedValue(91);
    const dataUrl = `data:image/png;base64,${Buffer.from("image-bytes").toString("base64")}`;

    const uploaded = await caller().vendor.uploadProductImage({ dataUrl });
    const additionalImage = "/uploads/vendor-products/7/product_456.jpg";
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
      imageUrl: "/uploads/vendor-products/7/product_123.webp",
      imageUrls: ["/uploads/vendor-products/7/product_123.webp", "/uploads/vendor-products/7/product_456.jpg"],
      status: "draft",
    }));
  });

  it("maps published products from an unverified vendor with persisted galleries and an unverified trust tag", async () => {
    mocks.listApprovedVendorProducts.mockResolvedValue([{
      id: 91,
      title: "Approved image find",
      category: "Fashion",
      price: 4500,
      description: "Approved for public category pages.",
      imageUrl: "/uploads/vendor-products/7/product_123.jpg",
      imageUrls: ["/uploads/vendor-products/7/product_123.jpg", "/uploads/vendor-products/7/product_456.jpg"],
      vendor: "Test Store",
      verificationStatus: "pending",
      lightningSeller: 0,
      averageRatingTenths: 0,
      ratingCount: 0,
    }]);

    await expect(caller().publicProducts()).resolves.toEqual([expect.objectContaining({
      id: "vendor-91",
      imageUrl: "/uploads/vendor-products/7/product_123.jpg",
      imageUrls: ["/uploads/vendor-products/7/product_123.jpg", "/uploads/vendor-products/7/product_456.jpg"],
      badge: "Seller find",
      categoryId: "fashion",
      categorySlug: "fashion",
      vendorTrust: { verification: "unverified", lightningSeller: false, topRated: false },
    })]);
  });

  it("exposes only qualified dynamic store trust signals for an approved vendor", async () => {
    mocks.listApprovedVendorProducts.mockResolvedValue([{
      id: 92, title: "Fast delivery find", category: "Vehicles", price: 3_500_000, description: "A verified seller vehicle listing for the public shop.", imageUrl: "/uploads/vendor-products/7/vehicle.jpg", imageUrls: ["/uploads/vendor-products/7/vehicle.jpg"], vendor: "Speedy Motors", verificationStatus: "approved", lightningSeller: 1, averageRatingTenths: 47, ratingCount: 12,
    }]);

    await expect(caller().publicProducts()).resolves.toEqual([expect.objectContaining({
      id: "vendor-92",
      categoryId: "vehicles",
      categorySlug: "vehicles",
      vendorTrust: { verification: "verified", lightningSeller: true, topRated: true },
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
      imageUrl: "/uploads/vendor-products/7/product_123.jpg",
      imageUrls: ["/uploads/vendor-products/7/product_123.jpg"],
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
    }), undefined);
  });

  it("allows administrators to review and publish a vendor draft", async () => {
    mocks.listAdminReviewProducts.mockResolvedValue([{ id: 91, productStatus: "draft" }]);
    await expect(adminCaller().admin.reviewProducts()).resolves.toEqual([{ id: 91, productStatus: "draft" }]);
    await expect(adminCaller().admin.setProductStatus({ id: 91, status: "active" })).resolves.toMatchObject({ id: 91, status: "active", publicCatalogueRevision: expect.any(Number) });
    expect(mocks.updateVendorProductStatus).toHaveBeenCalledWith(91, "active");
  });

  it("returns a bounded administrator saved-product page with the selected filters", async () => {
    const page = { items: [{ id: 120001, title: "CJ draft", status: "draft" }], total: 101, page: 2, pageSize: 100, totalPages: 2 };
    mocks.listAdminOfficialProducts.mockResolvedValue(page);

    await expect(adminCaller().admin.officialProducts({ status: "draft", category: "Fashion", search: "CJ jacket", page: 2, pageSize: 100 })).resolves.toEqual(page);
    expect(mocks.listAdminOfficialProducts).toHaveBeenCalledWith({ status: "draft", category: "Fashion", search: "CJ jacket", page: 2, pageSize: 100 });
  });

  it("limits saved-product pages to 100 entries at the procedure boundary", async () => {
    await expect(adminCaller().admin.officialProducts({ pageSize: 101 })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("scopes the vendor saved-product page to the caller's own seller application", async () => {
    mocks.getVendorApplicationForUser.mockResolvedValue(application);
    mocks.listVendorProducts.mockResolvedValue({ items: [{ id: 91, title: "My draft", status: "draft" }], total: 101, page: 1, pageSize: 100, totalPages: 2 });

    await expect(caller().vendor.dashboard({ status: "draft", category: "Fashion", search: "my", page: 1, pageSize: 100 })).resolves.toMatchObject({
      application,
      products: [{ id: 91, title: "My draft", status: "draft" }],
      productPage: { total: 101, page: 1, pageSize: 100, totalPages: 2 },
    });
    expect(mocks.listVendorProducts).toHaveBeenCalledWith(31, { status: "draft", category: "Fashion", search: "my", page: 1, pageSize: 100 });
  });

  it("allows a seller to edit only their own draft and retain its gallery when no replacements are sent", async () => {
    mocks.getVendorApplicationForUser.mockResolvedValue(application);
    mocks.getVendorProductForApplication.mockResolvedValue({ id: 91, status: "draft", imageUrl: "/uploads/vendor-products/7/product_123.jpg", imageUrls: ["/uploads/vendor-products/7/product_123.jpg"] });
    await expect(caller().vendor.updateDraftProduct({ id: 91, title: "Updated draft", category: "Fashion", price: 5000, description: "An updated product draft description." })).resolves.toEqual({ id: 91, status: "draft" });
    expect(mocks.updateVendorDraftProduct).toHaveBeenCalledWith(91, expect.objectContaining({ title: "Updated draft", imageUrls: ["/uploads/vendor-products/7/product_123.jpg"] }));
  });

  it("allows a seller to replace the complete image gallery on their own draft", async () => {
    mocks.getVendorApplicationForUser.mockResolvedValue(application);
    mocks.getVendorProductForApplication.mockResolvedValue({ id: 91, status: "draft", imageUrl: "/uploads/vendor-products/7/product_123.jpg", imageUrls: ["/uploads/vendor-products/7/product_123.jpg"] });
    const replacementGallery = ["/uploads/vendor-products/7/replacement_1.jpg", "/uploads/vendor-products/7/replacement_2.jpg"];
    await expect(caller().vendor.updateDraftProduct({ id: 91, title: "Updated draft", category: "Fashion", price: 5000, description: "An updated product draft description.", imageUrls: replacementGallery })).resolves.toEqual({ id: 91, status: "draft" });
    expect(mocks.updateVendorDraftProduct).toHaveBeenCalledWith(91, expect.objectContaining({ imageUrl: replacementGallery[0], imageUrls: replacementGallery }));
  });

  it("blocks edits to published products", async () => {
    mocks.getVendorApplicationForUser.mockResolvedValue(application);
    mocks.getVendorProductForApplication.mockResolvedValue({ id: 91, status: "active", imageUrl: "/uploads/vendor-products/7/product_123.jpg", imageUrls: ["/uploads/vendor-products/7/product_123.jpg"] });
    await expect(caller().vendor.updateDraftProduct({ id: 91, title: "Published find", category: "Fashion", price: 5000, description: "A published product cannot be edited here." })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});
