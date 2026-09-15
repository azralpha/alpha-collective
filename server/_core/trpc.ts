import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { extractClientIp } from "../referralFraud";
import { FixedWindowRateLimiter } from "../performanceControls";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;
const sensitiveMutationLimiter = new FixedWindowRateLimiter();

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

const sensitiveMutationProcedure = t.middleware(async opts => {
  if (opts.type !== "mutation") return opts.next();
  const path = opts.path ?? "unknown";
  const isCheckout = path === "marketplace.submitOrder" || path === "marketplace.wallet.checkout";
  const limit = isCheckout ? 8 : 12;
  const ip = opts.ctx.req ? extractClientIp(opts.ctx.req) ?? "unknown" : "test-context";
  const result = sensitiveMutationLimiter.consume({ key: `${path}:user:${opts.ctx.user?.id ?? "anonymous"}:ip:${ip}`, limit, windowMs: 60_000 });
  if (!result.allowed) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: `Too many requests. Please wait about ${result.retryAfterSeconds} seconds and try again.` });
  }
  return opts.next();
});

export const sensitiveProtectedProcedure = t.procedure.use(requireUser).use(sensitiveMutationProcedure);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
