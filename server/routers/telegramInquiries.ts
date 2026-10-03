import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getTelegramVendorLinkForUser, listTelegramInquiriesForBuyer } from "../db";
import { getTelegramProductForInquiry, getTelegramVendorLink, sendTelegramInquiry } from "../telegramInquiry";
import { sanitizePlainText } from "../securityText";

const productIdSchema = z.string().regex(/^vendor-(\d+)$/, "Only seller products support Telegram questions.");

export const telegramInquiriesRouter = router({
  vendorLink: protectedProcedure.query(async ({ ctx }) => {
    const application = await getTelegramVendorLinkForUser(ctx.user.id);
    if (!application) throw new TRPCError({ code: "NOT_FOUND", message: "Submit a vendor application before linking Telegram." });
    return {
      vendorId: application.vendorId,
      link: getTelegramVendorLink(application.vendorId),
      linked: Boolean(application.telegramChatId),
      linkedAt: application.telegramLinkedAt,
    };
  }),
  create: protectedProcedure.input(z.object({ productId: productIdSchema, question: z.string().trim().min(3).max(1000).transform(sanitizePlainText) })).mutation(async ({ ctx, input }) => {
    const productId = Number(input.productId.slice("vendor-".length));
    const product = await getTelegramProductForInquiry(productId);
    if (!product) throw new TRPCError({ code: "NOT_FOUND", message: "This seller product is no longer available." });
    if (!product.vendorChatId) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "This vendor has not linked Telegram yet. Please try again later." });
    try {
      return await sendTelegramInquiry({ buyerUserId: ctx.user.id, product, question: input.question });
    } catch (error) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error instanceof Error ? error.message : "Your question could not be sent." });
    }
  }),
  forProduct: protectedProcedure.input(z.object({ productId: productIdSchema })).query(async ({ ctx, input }) => {
    const productId = Number(input.productId.slice("vendor-".length));
    const inquiries = await listTelegramInquiriesForBuyer(ctx.user.id, productId);
    return inquiries.map(inquiry => ({ inquiryId: inquiry.inquiryId, question: inquiry.buyerQuestion, reply: inquiry.vendorReply, status: inquiry.status, createdAt: inquiry.createdAt, repliedAt: inquiry.repliedAt }));
  }),
});
