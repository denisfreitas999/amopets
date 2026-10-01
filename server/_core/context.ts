import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { getAdminByRequest } from "../adminAuth";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  adminSession: boolean;
};

export async function createContext(opts: CreateExpressContextOptions): Promise<TrpcContext> {
  const admin = await getAdminByRequest(opts.req);
  if (admin) {
    return { req: opts.req, res: opts.res, adminSession: true, user: { id: admin.id, openId: `admin:${admin.id}`, name: admin.name, email: admin.username, loginMethod: "password", role: "admin", createdAt: admin.createdAt, updatedAt: admin.updatedAt, lastSignedIn: admin.lastLoginAt || admin.createdAt } };
  }
  let user: User | null = null;
  try { user = await sdk.authenticateRequest(opts.req); } catch { user = null; }
  return { req: opts.req, res: opts.res, user, adminSession: false };
}
