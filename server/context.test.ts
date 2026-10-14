import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";
import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { createContext, type TrpcContext } from "./_core/context";
import { adminProcedure, router } from "./_core/trpc";
import type { User } from "../drizzle/schema";

vi.mock("./adminAuth", () => ({
  getAdminByRequest: vi.fn(),
}));

vi.mock("./_core/sdk", () => ({
  sdk: {
    authenticateRequest: vi.fn(),
  },
}));

import { getAdminByRequest } from "./adminAuth";
import { sdk } from "./_core/sdk";

const testRouter = router({
  adminOnly: adminProcedure.query(() => "ok"),
});

const mockAdminUser = {
  id: 1,
  name: "Administrador Teste",
  username: "admin@amopets.com.br",
  passwordHash: "hash",
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastLoginAt: null,
};

const mockClientUser: User = {
  id: 42,
  openId: "google-12345",
  name: "Cliente Real",
  email: "cliente@gmail.com",
  loginMethod: "google",
  role: "user",
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

function createMockOptions(): CreateExpressContextOptions {
  const req = {
    headers: {},
    cookies: {},
    protocol: "http",
  } as unknown as Request;
  const res = {} as unknown as Response;
  return { req, res };
}

describe("Separação de contexto entre Cliente e Admin (Passo C1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("a) só ADMIN_COOKIE válido: adminProcedure funciona e ctx.user é null", async () => {
    vi.mocked(getAdminByRequest).mockResolvedValue(mockAdminUser);
    vi.mocked(sdk.authenticateRequest).mockResolvedValue(null);

    const ctx = await createContext(createMockOptions());

    expect(ctx.user).toBeNull();
    expect(ctx.admin).toEqual({
      id: mockAdminUser.id,
      name: mockAdminUser.name,
      username: mockAdminUser.username,
    });
    expect(ctx.adminSession).toBe(true);

    const caller = testRouter.createCaller(ctx);
    const result = await caller.adminOnly();
    expect(result).toBe("ok");
  });

  it("b) só sessão de cliente real (COOKIE_NAME): adminProcedure responde UNAUTHORIZED", async () => {
    vi.mocked(getAdminByRequest).mockResolvedValue(null);
    vi.mocked(sdk.authenticateRequest).mockResolvedValue(mockClientUser);

    const ctx = await createContext(createMockOptions());

    expect(ctx.user).toEqual(mockClientUser);
    expect(ctx.admin).toBeNull();
    expect(ctx.adminSession).toBe(false);

    const caller = testRouter.createCaller(ctx);
    await expect(caller.adminOnly()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("c) os dois cookies: ctx.user é o cliente real e ctx.admin é o admin", async () => {
    vi.mocked(getAdminByRequest).mockResolvedValue(mockAdminUser);
    vi.mocked(sdk.authenticateRequest).mockResolvedValue(mockClientUser);

    const ctx = await createContext(createMockOptions());

    expect(ctx.user).toEqual(mockClientUser);
    expect(ctx.admin).toEqual({
      id: mockAdminUser.id,
      name: mockAdminUser.name,
      username: mockAdminUser.username,
    });
    expect(ctx.adminSession).toBe(true);

    const caller = testRouter.createCaller(ctx);
    const result = await caller.adminOnly();
    expect(result).toBe("ok");
  });

  it("d) nenhum cookie: ctx.user e ctx.admin são null e adminProcedure responde UNAUTHORIZED", async () => {
    vi.mocked(getAdminByRequest).mockResolvedValue(null);
    vi.mocked(sdk.authenticateRequest).mockResolvedValue(null);

    const ctx = await createContext(createMockOptions());

    expect(ctx.user).toBeNull();
    expect(ctx.admin).toBeNull();
    expect(ctx.adminSession).toBe(false);

    const caller = testRouter.createCaller(ctx);
    await expect(caller.adminOnly()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});
