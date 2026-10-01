import crypto from "node:crypto";
import type { Request } from "express";
import { eq } from "drizzle-orm";
import { adminUsers } from "../drizzle/schema";
import { getDb } from "./db";

export const ADMIN_COOKIE = "amopets_admin_session";
const TOKEN_TTL_SECONDS = 60 * 60 * 12;
const secret = () => process.env.JWT_SECRET || "amopets-development-secret";

export function hashAdminPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

export function verifyAdminPassword(password: string, encoded: string) {
  const [algorithm, salt, expected] = encoded.split("$");
  if (algorithm !== "scrypt" || !salt || !expected) return false;
  const actual = crypto.scryptSync(password, salt, 64).toString("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(actual, "hex");
  return expectedBuffer.length === actualBuffer.length && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

function sign(payload: string) {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createAdminToken(adminId: number) {
  const expiresAt = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;
  const payload = `${adminId}.${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

function verifyAdminToken(token: string) {
  const [adminId, expiresAt, signature] = token.split(".");
  if (!adminId || !expiresAt || !signature || Number(expiresAt) < Math.floor(Date.now() / 1000)) return null;
  const payload = `${adminId}.${expiresAt}`;
  const expected = sign(payload);
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  return Number(adminId);
}

export async function getAdminByRequest(req: Request) {
  const token = req.headers.cookie?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${ADMIN_COOKIE}=`))?.slice(ADMIN_COOKIE.length + 1);
  const adminId = token ? verifyAdminToken(token) : null;
  if (!adminId) return null;
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(adminUsers).where(eq(adminUsers.id, adminId)).limit(1);
  const admin = result[0];
  return admin?.active ? admin : null;
}

export async function getAdminByUsername(username: string) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(adminUsers).where(eq(adminUsers.username, username)).limit(1);
  return result[0] || null;
}

export async function markAdminLogin(id: number) {
  const db = await getDb();
  if (db) await db.update(adminUsers).set({ lastLoginAt: new Date() }).where(eq(adminUsers.id, id));
}
