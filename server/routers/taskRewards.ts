import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getTaskEarnDashboard, screenTaskTraffic } from "../taskRewards";

export const taskRewardsRouter = router({
  dashboard: protectedProcedure.query(({ ctx }) => getTaskEarnDashboard(ctx.user.id)),
  offerwallSession: protectedProcedure.input(z.object({ provider: z.string().min(2).max(80) })).query(({ ctx, input }) => {
    if (!screenTaskTraffic(ctx.req)) throw new TRPCError({ code: "FORBIDDEN", message: "Offerwall access is unavailable from this network." });
    return { provider: input.provider, userId: ctx.user.id, subId: String(ctx.user.id), enabled: false, message: "Offerwall provider is not configured yet. This secure container is ready for a provider SDK." };
  }),
});
