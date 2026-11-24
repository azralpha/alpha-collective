import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  adminApiUser: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;
  let adminApiUser: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  const explicitApiKey = opts.req.headers["x-admin-api-key"] !== undefined;
  const bearerWithoutSession = !user && /^Bearer\s+\S+/i.test(opts.req.headers.authorization ?? "");
  if (explicitApiKey || bearerWithoutSession) {
    try {
      adminApiUser = await sdk.authenticateAdminApiKey(opts.req);
    } catch {
      adminApiUser = null;
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    adminApiUser,
  };
}
