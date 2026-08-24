import { TRPCError } from "@trpc/server";
import { customAlphabet } from "nanoid";
import { z } from "zod";
import {
  DELIVERY_FEE,
  MARKETPLACE_CATEGORIES,
  REFERRAL_DISCOUNT,
  REFERRAL_MINIMUM_SUBTOTAL,
  getCartSubtotal,
  qualifiesForReferralDiscount,
  resolveCartLines,
} from "../../shared/marketplace";
import {
  createOrder,
  createReferralShare,
  createVendorApplication,
  createVendorProduct,
  getReferralShareByCode,
  getReferralShareByRewardCode,
  getVendorApplicationForUser,
  listAdminReviewProducts,
  listApprovedVendorProducts,
  listReferralSharesForUser,
  listVendorProducts,
  qualifyReferralShare,
  redeemReferralReward,
  updateVendorProductStatus,
} from "../db";
import { storagePut } from "../storage";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "../_core/trpc";

const cartLineSchema = z.object({ productId: z.string().min(1), quantity: z.number().int().min(1).max(10) });
const shareCodeAlphabet = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 8);
const orderReferenceAlphabet = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 8);
const rewardCodeAlphabet = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 8);

function newShareCode() { return `ALPHA-${shareCodeAlphabet()}`; }
function newOrderReference() { return `AC-${orderReferenceAlphabet()}`; }
function newRewardCode() { return `THANKS-${rewardCodeAlphabet()}`; }

const productImageDataUrlSchema = z.string().max(7_000_000);

function decodeProductImage(dataUrl: string) {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) throw new TRPCError({ code: "BAD_REQUEST", message: "Upload a JPG, PNG, or WebP image." });
  const [, contentType, base64] = match;
  const data = Buffer.from(base64, "base64");
  if (data.length === 0 || data.length > 5 * 1024 * 1024) {
    throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Product images must be 5 MB or smaller." });
  }
  const extension = contentType === "image/jpeg" ? "jpg" : contentType.split("/")[1];
  return { contentType, data, extension };
}

export const marketplaceRouter = router({
  publicProducts: publicProcedure.query(async () => {
    const products = await listApprovedVendorProducts();
    return products.flatMap(product => {
      const imageUrls = (product.imageUrls?.length ? product.imageUrls : product.imageUrl ? [product.imageUrl] : []).filter(Boolean);
      return imageUrls.length ? [{
        id: `vendor-${product.id}`,
        title: product.title,
        vendor: product.vendor,
        category: product.category,
        price: product.price,
        formerPrice: undefined,
        badge: "Verified seller find",
        imageUrl: imageUrls[0],
        imageUrls,
        description: product.description,
        detail: product.description,
      }] : [];
    });
  }),
  admin: router({
    reviewProducts: adminProcedure.query(() => listAdminReviewProducts()),
    setProductStatus: adminProcedure
      .input(z.object({ id: z.number().int().positive(), status: z.enum(["active", "rejected"]) }))
      .mutation(async ({ input }) => {
        await updateVendorProductStatus(input.id, input.status);
        return { id: input.id, status: input.status };
      }),
  }),
  createReferralShare: protectedProcedure
    .input(z.object({ channel: z.enum(["whatsapp", "tiktok", "instagram", "other"]) }))
    .mutation(async ({ ctx, input }) => {
      const shareCode = newShareCode();
      await createReferralShare({ shareCode, channel: input.channel, sharerUserId: ctx.user.id });
      return { shareCode, rewardValue: REFERRAL_DISCOUNT };
    }),

  myReferralStatus: protectedProcedure.query(async ({ ctx }) => {
    const shares = await listReferralSharesForUser(ctx.user.id);
    return shares.map(share => ({
      shareCode: share.shareCode,
      status: share.status,
      rewardStatus: share.rewardStatus,
      rewardCode: share.rewardStatus === "issued" ? share.rewardCode : null,
      rewardValue: share.rewardValue,
    }));
  }),

  submitOrder: publicProcedure
    .input(z.object({
      buyerName: z.string().trim().min(2).max(120),
      buyerPhone: z.string().trim().min(7).max(32),
      deliveryAddress: z.string().trim().min(12).max(500),
      items: z.array(cartLineSchema).min(1).max(12),
      referralCode: z.string().trim().max(32).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const resolvedLines = resolveCartLines(input.items);
      if (resolvedLines.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Your cart does not contain a valid product." });

      const subtotal = getCartSubtotal(input.items);
      let appliedCode: string | undefined;
      let discountType: "none" | "referral" | "reward" = "none";
      let discount = 0;

      if (input.referralCode) {
        if (!ctx.user) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Sign in to redeem a referral or earned reward code." });
        }
        if (!qualifiesForReferralDiscount(subtotal)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `Discount codes apply to orders from ₦${REFERRAL_MINIMUM_SUBTOTAL.toLocaleString("en-NG")}.` });
        }

        const candidate = input.referralCode.toUpperCase();
        if (candidate.startsWith("ALPHA-")) {
          const referralShare = await getReferralShareByCode(candidate);
          if (!referralShare || referralShare.status !== "shared") {
            throw new TRPCError({ code: "BAD_REQUEST", message: "That referral code is unavailable or has already been used." });
          }
          if (referralShare.sharerUserId === ctx.user.id) {
            throw new TRPCError({ code: "FORBIDDEN", message: "You cannot use your own referral code." });
          }
          appliedCode = candidate;
          discountType = "referral";
          discount = REFERRAL_DISCOUNT;
        } else if (candidate.startsWith("THANKS-")) {
          const reward = await getReferralShareByRewardCode(candidate);
          if (!reward || reward.rewardStatus !== "issued" || reward.sharerUserId !== ctx.user.id) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "That earned reward code is unavailable for this account." });
          }
          appliedCode = candidate;
          discountType = "reward";
          discount = REFERRAL_DISCOUNT;
        } else {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Enter a referral code beginning ALPHA- or an earned reward code beginning THANKS-." });
        }
      }

      const reference = newOrderReference();
      const total = subtotal - discount + DELIVERY_FEE;
      await createOrder({
        reference,
        buyerUserId: ctx.user?.id,
        buyerName: input.buyerName,
        buyerPhone: input.buyerPhone,
        deliveryAddress: input.deliveryAddress,
        paymentMethod: "delivery",
        paymentStatus: "cod_pending",
        subtotal,
        referralDiscount: discount,
        deliveryFee: DELIVERY_FEE,
        total,
        referralCode: appliedCode,
        discountType,
        orderLines: resolvedLines.map(line => ({ productId: line.product.id, title: line.product.title, quantity: line.quantity, unitPrice: line.product.price, lineTotal: line.lineTotal })),
      });

      if (discountType === "referral" && appliedCode) await qualifyReferralShare(appliedCode, reference, newRewardCode());
      if (discountType === "reward" && appliedCode && ctx.user) await redeemReferralReward(appliedCode, ctx.user.id);
      return { reference, paymentStatus: "cod_pending" as const, subtotal, discount, deliveryFee: DELIVERY_FEE, total };
    }),

  vendor: router({
    dashboard: protectedProcedure.query(async ({ ctx }) => {
      const application = await getVendorApplicationForUser(ctx.user.id);
      if (!application) return { application: null, products: [] };
      const products = await listVendorProducts(application.id);
      return { application, products };
    }),
    submitApplication: protectedProcedure
      .input(z.object({ name: z.string().trim().min(2).max(120), storeName: z.string().trim().min(2).max(160), whatsapp: z.string().trim().min(7).max(32), category: z.enum(MARKETPLACE_CATEGORIES) }))
      .mutation(async ({ ctx, input }) => {
        const existing = await getVendorApplicationForUser(ctx.user.id);
        if (existing) return { application: existing, alreadySubmitted: true };
        const id = await createVendorApplication({ userId: ctx.user.id, name: input.name, storeName: input.storeName, whatsapp: input.whatsapp, category: input.category, commissionRate: 12, status: "pending" });
        const application = await getVendorApplicationForUser(ctx.user.id);
        if (!application) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Application ${id} could not be loaded.` });
        return { application, alreadySubmitted: false };
      }),
    uploadProductImage: protectedProcedure
      .input(z.object({ dataUrl: productImageDataUrlSchema }))
      .mutation(async ({ ctx, input }) => {
        const { contentType, data, extension } = decodeProductImage(input.dataUrl);
        const result = await storagePut(`vendor-products/${ctx.user.id}/${Date.now()}.${extension}`, data, contentType);
        return { imageUrl: result.url };
      }),
    createProduct: protectedProcedure
      .input(z.object({ title: z.string().trim().min(2).max(180), category: z.enum(MARKETPLACE_CATEGORIES), price: z.number().int().min(500).max(5000000), description: z.string().trim().min(12).max(1200), imageUrls: z.array(z.string().startsWith("/manus-storage/").max(500)).min(1).max(5) }))
      .mutation(async ({ ctx, input }) => {
        const application = await getVendorApplicationForUser(ctx.user.id);
        if (!application) throw new TRPCError({ code: "BAD_REQUEST", message: "Submit your seller application before adding a product." });
        if (input.imageUrls.some(imageUrl => !imageUrl.startsWith(`/manus-storage/vendor-products/${ctx.user.id}/`))) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Upload all product images from your seller account first." });
        }
        const id = await createVendorProduct({ vendorApplicationId: application.id, title: input.title, category: input.category, price: input.price, description: input.description, imageUrl: input.imageUrls[0], imageUrls: input.imageUrls, status: "draft" });
        return { id, status: "draft" as const };
      }),
  }),
});
