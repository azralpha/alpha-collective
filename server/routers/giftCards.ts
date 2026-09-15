import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { extractClientIp } from "../referralFraud";
import { GIFT_CARD_AMOUNTS, initiateGiftCardPurchase, redeemGiftCard } from "../giftCards";

export const giftCardsRouter = router({
  initiatePurchase: protectedProcedure.input(z.object({
    amount: z.number().int().refine(value => GIFT_CARD_AMOUNTS.includes(value as typeof GIFT_CARD_AMOUNTS[number]), "Choose a supported gift-card amount."),
    recipientEmail: z.string().email(),
  })).mutation(async ({ ctx, input }) => {
    if (!ctx.user.email) throw new Error("Your account does not have a verified email address.");
    return initiateGiftCardPurchase({ userId: ctx.user.id, amount: input.amount, purchaserEmail: ctx.user.email, recipientEmail: input.recipientEmail, purchaserIp: extractClientIp(ctx.req) ?? "unknown", redirectUrl: `${process.env.APP_BASE_URL ?? "http://localhost:3000"}/wallet?giftCard=complete` });
  }),
  redeem: protectedProcedure.input(z.object({ code: z.string().min(10).max(24), cartTotal: z.number().int().positive(), captchaToken: z.string().optional() })).mutation(({ ctx, input }) => redeemGiftCard({ ...input, ip: extractClientIp(ctx.req) ?? "unknown" })),
});
