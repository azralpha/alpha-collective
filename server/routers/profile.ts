import { z } from "zod";
import { protectedProcedure, router, sensitiveProtectedProcedure } from "../_core/trpc";
import { deleteAddress, getProfileDashboard, saveAddress, toggleFollowedVendor, setDefaultAddress, updateProfile, uploadProfileAvatar } from "../profileDashboard";
import { getKycProfileForUser } from "../db";
import { createDiditSession } from "../didit";

const profileInput = z.object({
  username: z.string().max(80).optional(),
  phone: z.string().max(32).optional(),
  legalName: z.string().max(160).optional(),
  dateOfBirth: z.string().max(10).optional(),
});

const addressInput = z.object({
  id: z.number().int().positive().optional(),
  label: z.string().max(60),
  recipientName: z.string().max(120),
  phone: z.string().max(32),
  state: z.string().max(80),
  lga: z.string().max(100),
  streetDetails: z.string().max(255),
  isDefault: z.boolean().optional(),
});

export const profileRouter = router({
  dashboard: protectedProcedure.query(({ ctx }) => getProfileDashboard(ctx.user.id)),
  diditStatus: protectedProcedure.query(async ({ ctx }) => {
    const profile = await getKycProfileForUser(ctx.user.id);
    return { status: profile?.status ?? "not_started", providerStatus: profile?.diditStatus ?? null, updatedAt: profile?.diditUpdatedAt ?? null };
  }),
  startDiditVerification: sensitiveProtectedProcedure.mutation(({ ctx }) => createDiditSession({ userId: ctx.user.id, email: ctx.user.email, legalName: ctx.user.name })),
  update: sensitiveProtectedProcedure.input(profileInput).mutation(({ ctx, input }) => updateProfile({ userId: ctx.user.id, ...input })),
  uploadAvatar: sensitiveProtectedProcedure.input(z.object({ dataUrl: z.string().max(3_000_000) })).mutation(({ ctx, input }) => uploadProfileAvatar({ userId: ctx.user.id, dataUrl: input.dataUrl })),
  toggleFollowVendor: sensitiveProtectedProcedure.input(z.object({ vendorUserId: z.number().int().positive() })).mutation(({ ctx, input }) => toggleFollowedVendor({ userId: ctx.user.id, vendorUserId: input.vendorUserId })),
  saveAddress: sensitiveProtectedProcedure.input(addressInput).mutation(({ ctx, input }) => saveAddress({ userId: ctx.user.id, ...input })),
  deleteAddress: sensitiveProtectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => deleteAddress({ userId: ctx.user.id, id: input.id })),
  setDefaultAddress: sensitiveProtectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => setDefaultAddress({ userId: ctx.user.id, id: input.id })),
});
