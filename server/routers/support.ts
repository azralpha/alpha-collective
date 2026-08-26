import { publicProcedure, router } from "../_core/trpc";
import { answerAlphaAiSupport, alphaAiSupportInputSchema } from "../alphaAiSupport";

export const supportRouter = router({
  chat: publicProcedure.input(alphaAiSupportInputSchema).mutation(({ ctx, input }) => answerAlphaAiSupport({ userId: ctx.user?.id, messages: input.messages })),
});
