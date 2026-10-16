import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { getSessionCookieOptions } from "./_core/cookies";
import { COOKIE_NAME } from "../shared/const";
import * as db from "./db";
import { decodeJwt, SignJWT } from "jose";
import { createContext } from "./_core/context";
import { assertSessionSecret } from "./_core/env";

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

describe("Endurecimento da sessão (Passo H1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("a) assertSessionSecret: em production lança erro se JWT_SECRET ausente ou < 32 chars; em development apenas avisa", () => {
    // production: ausente
    expect(() => assertSessionSecret({ NODE_ENV: "production", JWT_SECRET: "" })).toThrow(/JWT_SECRET/);
    expect(() => assertSessionSecret({ NODE_ENV: "production" })).toThrow(/JWT_SECRET/);

    // production: menos de 32 caracteres
    expect(() => assertSessionSecret({ NODE_ENV: "production", JWT_SECRET: "curto-123456" })).toThrow(/32 caracteres/);

    // production: 32 caracteres ou mais
    expect(assertSessionSecret({ NODE_ENV: "production", JWT_SECRET: "01234567890123456789012345678901" })).toBe(true);

    // development: emite aviso sem lançar erro
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => assertSessionSecret({ NODE_ENV: "development", JWT_SECRET: "curto" })).not.toThrow();
    expect(() => assertSessionSecret({ NODE_ENV: "development", JWT_SECRET: "" })).not.toThrow();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("b) verifySession rejeita um token assinado com o segredo correto mas SEM claim exp", async () => {
    const secretKey = (sdk as any).getSessionSecret();
    const tokenWithoutExp = await new SignJWT({
      openId: "user-without-exp",
      appId: "amopets",
      name: "Usuario Sem Exp",
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .sign(secretKey);

    const result = await sdk.verifySession(tokenWithoutExp);
    expect(result).toBeNull();
  });

  it("c) setDb lança erro quando NODE_ENV não é 'test'", () => {
    const originalEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = "production";
      expect(() => db.setDb(null)).toThrow(/NODE_ENV/);

      process.env.NODE_ENV = "development";
      expect(() => db.setDb(null)).toThrow(/NODE_ENV/);

      process.env.NODE_ENV = "test";
      expect(() => db.setDb(null)).not.toThrow();
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  it("d) authenticateRequest NÃO grava lastSignedIn se o último valor tem menos de 1 hora, e grava se tem mais de 1 hora", async () => {
    vi.useFakeTimers();
    try {
      const baseTime = new Date("2026-10-14T12:00:00Z");
      vi.setSystemTime(baseTime);

      const token = await sdk.signSession({
        openId: "user-rate-limit-test",
        appId: "amopets",
        name: "Cliente Rate Limit",
      });
      const req = {
        headers: { cookie: `${COOKIE_NAME}=${token}` },
        protocol: "http",
      } as unknown as Request;

      // Caso 1: lastSignedIn há 30 minutos (< 1 hora) -> NÃO deve chamar upsertUser
      vi.mocked(db.getUserByOpenId).mockResolvedValue({
        id: 10,
        openId: "user-rate-limit-test",
        name: "Cliente Rate Limit",
        role: "user",
        email: "teste@example.com",
        loginMethod: "google",
        createdAt: new Date("2026-01-01"),
        lastSignedIn: new Date("2026-10-14T11:30:00Z"), // 30 minutos antes
      });

      const user1 = await sdk.authenticateRequest(req);
      expect(user1).not.toBeNull();
      expect(db.upsertUser).not.toHaveBeenCalled();

      // Caso 2: lastSignedIn há 65 minutos (> 1 hora) -> DEVE chamar upsertUser
      vi.mocked(db.upsertUser).mockClear();
      vi.mocked(db.getUserByOpenId).mockResolvedValue({
        id: 10,
        openId: "user-rate-limit-test",
        name: "Cliente Rate Limit",
        role: "user",
        email: "teste@example.com",
        loginMethod: "google",
        createdAt: new Date("2026-01-01"),
        lastSignedIn: new Date("2026-10-14T10:55:00Z"), // 65 minutos antes
      });

      const user2 = await sdk.authenticateRequest(req);
      expect(user2).not.toBeNull();
      expect(db.upsertUser).toHaveBeenCalledTimes(1);
      expect(db.upsertUser).toHaveBeenCalledWith({
        openId: "user-rate-limit-test",
        lastSignedIn: baseTime,
      });

      // Caso 3: avança o tempo em 2 horas -> DEVE chamar upsertUser
      vi.mocked(db.upsertUser).mockClear();
      vi.advanceTimersByTime(2 * 60 * 60 * 1000); // 14:00:00Z
      const newNow = new Date("2026-10-14T14:00:00Z");

      vi.mocked(db.getUserByOpenId).mockResolvedValue({
        id: 10,
        openId: "user-rate-limit-test",
        name: "Cliente Rate Limit",
        role: "user",
        email: "teste@example.com",
        loginMethod: "google",
        createdAt: new Date("2026-01-01"),
        lastSignedIn: new Date("2026-10-14T11:30:00Z"),
      });

      const user3 = await sdk.authenticateRequest(req);
      expect(user3).not.toBeNull();
      expect(db.upsertUser).toHaveBeenCalledTimes(1);
      expect(db.upsertUser).toHaveBeenCalledWith({
        openId: "user-rate-limit-test",
        lastSignedIn: newNow,
      });
    } finally {
      vi.useRealTimers();
    }
  });
});

