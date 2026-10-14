import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { getSessionCookieOptions } from "./_core/cookies";
import { COOKIE_NAME } from "../shared/const";
import * as db from "./db";
import { decodeJwt, SignJWT } from "jose";
import { createContext } from "./_core/context";

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getUserByOpenId: vi.fn(),
    upsertUser: vi.fn(),
  };
});

describe("Sessão do cliente (Passo D1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("a) token de sessão com openId que NÃO existe no banco não autentica e NENHUMA chamada de rede é feita", async () => {
    vi.mocked(db.getUserByOpenId).mockResolvedValue(null);
    const postSpy = (sdk as any).client ? vi.spyOn((sdk as any).client, "post") : null;
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const token = await sdk.signSession({
      openId: "nonexistent-openid-404",
      appId: "test-app-id",
      name: "Cliente Teste",
    });
    const req = {
      headers: { cookie: `${COOKIE_NAME}=${token}` },
      protocol: "http",
    } as unknown as Request;

    const user = await sdk.authenticateRequest(req).catch(() => null);
    expect(user).toBeNull();

    const ctx = await createContext({ req, res: {} as Response });
    expect(ctx.user).toBeNull();

    if (postSpy) expect(postSpy).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("b) token expirado ou com assinatura inválida não autentica", async () => {
    const invalidToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJvcGVuSWQiOiJmb28iLCJhcHBJZCI6ImJhciIsIm5hbWUiOiJCYXIifQ.invalida";
    const reqInvalid = {
      headers: { cookie: `${COOKIE_NAME}=${invalidToken}` },
      protocol: "http",
    } as unknown as Request;

    const userInvalid = await sdk.authenticateRequest(reqInvalid).catch(() => null);
    expect(userInvalid).toBeNull();

    const expiredToken = await new SignJWT({ openId: "expired-user", appId: "test", name: "Expired" })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign((sdk as any).getSessionSecret());

    const reqExpired = {
      headers: { cookie: `${COOKIE_NAME}=${expiredToken}` },
      protocol: "http",
    } as unknown as Request;

    const userExpired = await sdk.authenticateRequest(reqExpired).catch(() => null);
    expect(userExpired).toBeNull();
  });

  it("c) opções do cookie: por padrão SameSite 'lax'; COOKIE_SAMESITE=none gera 'none' com Secure forçado; 'strict' é aceito; valor inválido volta para 'lax'", () => {
    const originalEnv = process.env.COOKIE_SAMESITE;
    const reqHttp = { protocol: "http", headers: {} } as Request;
    const reqHttps = { protocol: "https", headers: {} } as Request;

    try {
      delete process.env.COOKIE_SAMESITE;
      expect(getSessionCookieOptions(reqHttp).sameSite).toBe("lax");
      expect(getSessionCookieOptions(reqHttps).sameSite).toBe("lax");

      process.env.COOKIE_SAMESITE = "none";
      const optsNone = getSessionCookieOptions(reqHttp);
      expect(optsNone.sameSite).toBe("none");
      expect(optsNone.secure).toBe(true);

      process.env.COOKIE_SAMESITE = "strict";
      const optsStrict = getSessionCookieOptions(reqHttp);
      expect(optsStrict.sameSite).toBe("strict");

      process.env.COOKIE_SAMESITE = "algo_invalido";
      const optsInvalid = getSessionCookieOptions(reqHttp);
      expect(optsInvalid.sameSite).toBe("lax");
    } finally {
      if (originalEnv !== undefined) {
        process.env.COOKIE_SAMESITE = originalEnv;
      } else {
        delete process.env.COOKIE_SAMESITE;
      }
    }
  });

  it("d) validade do cookie (maxAge) e do JWT (exp) é de 30 dias", async () => {
    const req = { protocol: "https", headers: {} } as Request;
    const cookieOpts = getSessionCookieOptions(req);
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

    expect(cookieOpts.maxAge).toBe(THIRTY_DAYS_MS);

    const now = Math.floor(Date.now() / 1000);
    const token = await sdk.signSession({ openId: "user-30d", appId: "test", name: "Test User" });
    const decoded = decodeJwt(token);

    expect(decoded.exp).toBeDefined();
    const deltaSeconds = (decoded.exp as number) - now;
    expect(deltaSeconds).toBeGreaterThanOrEqual(30 * 86400 - 5);
    expect(deltaSeconds).toBeLessThanOrEqual(30 * 86400 + 5);
  });

  it("e) httpOnly é sempre true; secure é true quando a requisição é HTTPS", () => {
    const originalEnv = process.env.COOKIE_SAMESITE;
    try {
      delete process.env.COOKIE_SAMESITE;
      const reqHttp = { protocol: "http", headers: {} } as Request;
      const reqHttps = { protocol: "https", headers: {} } as Request;

      const optsHttp = getSessionCookieOptions(reqHttp);
      expect(optsHttp.httpOnly).toBe(true);
      expect(optsHttp.secure).toBe(false);

      const optsHttps = getSessionCookieOptions(reqHttps);
      expect(optsHttps.httpOnly).toBe(true);
      expect(optsHttps.secure).toBe(true);
    } finally {
      if (originalEnv !== undefined) {
        process.env.COOKIE_SAMESITE = originalEnv;
      } else {
        delete process.env.COOKIE_SAMESITE;
      }
    }
  });
});
