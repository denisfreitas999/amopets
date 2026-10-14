import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { getAdminByRequest } from "../adminAuth";
import { sdk } from "./sdk";

export type AdminSessionUser = {
  id: number;
  name: string;
  username: string;
};

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  admin: AdminSessionUser | null;
  adminSession: boolean;
};

export async function createContext(opts: CreateExpressContextOptions): Promise<TrpcContext> {
  let admin: AdminSessionUser | null = null;
  let adminSession = false;

  try {
    const adminUser = await getAdminByRequest(opts.req);
    if (adminUser) {
      admin = {
        id: adminUser.id,
        name: adminUser.name,
        username: adminUser.username,
      };
      adminSession = true;
    }
  } catch {
    admin = null;
    adminSession = false;
  }

  let user: User | null = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch {
    user = null;
  }

  return { req: opts.req, res: opts.res, user, admin, adminSession };
}
