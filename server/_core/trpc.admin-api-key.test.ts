import { describe, expect, it } from "vitest";
import { adminProcedure, protectedProcedure, router } from "./trpc";

const testRouter = router({
  adminId: adminProcedure.query(({ ctx }) => ctx.user.id),
  protectedId: protectedProcedure.query(({ ctx }) => ctx.user.id),
});

const adminApiUser = { id: 9, role: "admin" };
const fakeRequest = { headers: { "x-admin-api-key": "bad-key", "x-forwarded-for": "198.51.100.20" } };
const fakeResponse = {};

describe("admin API-key procedure boundary", () => {
  it("allows admin procedures using an already-verified API-key owner context", async () => {
    const caller = testRouter.createCaller({ user: null, adminApiUser, req: fakeRequest, res: fakeResponse } as never);
    await expect(caller.adminId()).resolves.toBe(9);
  });

  it("does not let the separate API-key identity authenticate ordinary protected-user procedures", async () => {
    const caller = testRouter.createCaller({ user: null, adminApiUser, req: fakeRequest, res: fakeResponse } as never);
    await expect(caller.protectedId()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("continues to accept a normal signed-in admin session without an API-key context", async () => {
    const caller = testRouter.createCaller({ user: { id: 7, role: "admin" }, adminApiUser: null, req: fakeRequest, res: fakeResponse } as never);
    await expect(caller.adminId()).resolves.toBe(7);
  });
});
