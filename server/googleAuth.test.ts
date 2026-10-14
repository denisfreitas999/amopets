import { describe, expect, it, vi, beforeEach } from "vitest";
import express, { type Request, type Response } from "express";
import { COOKIE_NAME, SESSION_DURATION_MS } from "../shared/const";
import * as db from "./db";
import { ENV } from "./_core/env";
import {
  registerGoogleAuthRoutes,
  handleGoogleAuth,
  handleGoogleAuthCallback,
  GOOGLE_AUTH_STATE_COOKIE,
  GOOGLE_AUTH_VERIFIER_COOKIE,
  GOOGLE_AUTH_NONCE_COOKIE,
} from "./_core/googleAuth";

// Mocks para google-auth-library
const mockGenerateCodeVerifierAsync = vi.fn().mockResolvedValue({
  codeVerifier: "mock-code-verifier-string-1234567890",
  codeChallenge: "mock-code-challenge-string-1234567890",
});

const mockGenerateAuthUrl = vi.fn().mockImplementation((opts: any) => {
  const params = new URLSearchParams({
    client_id: opts.client_id || (ENV as any).googleClientId || "mock-client-id",
    redirect_uri: opts.redirect_uri || `${(ENV as any).appUrl}/api/auth/google/callback`,
    response_type: opts.response_type || "code",
    scope: Array.isArray(opts.scope) ? opts.scope.join(" ") : opts.scope,
    code_challenge: opts.code_challenge,
    code_challenge_method: opts.code_challenge_method,
    state: opts.state,
    nonce: opts.nonce,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
});

const mockGetToken = vi.fn().mockResolvedValue({
  tokens: {
    id_token: "mock-valid-id-token-abc",
  },
});

const mockVerifyIdToken = vi.fn().mockResolvedValue({
  getPayload: () => ({
    sub: "mock-sub-12345",
    email: "cliente@gmail.com",
    email_verified: true,
    name: "Maria Silva",
    nonce: "mock-nonce-valid",
  }),
});

vi.mock("google-auth-library", () => {
  return {
    CodeChallengeMethod: {
      Plain: "plain",
      S256: "S256",
    },
    OAuth2Client: class {
      generateCodeVerifierAsync = mockGenerateCodeVerifierAsync;
      generateAuthUrl = mockGenerateAuthUrl;
      getToken = mockGetToken;
      verifyIdToken = mockVerifyIdToken;
      constructor(_opts?: any) {}
    },
  };
});

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    upsertUser: vi.fn(),
  };
});

function createMockReqRes(options: {
  url?: string;
  query?: Record<string, string>;
  headers?: Record<string, string>;
  protocol?: string;
}) {
  const req = {
    url: options.url || "/",
    query: options.query || {},
    headers: options.headers || {},
    protocol: options.protocol || "http",
  } as unknown as Request;

  let statusCode = 200;
  let responseData: any = null;
  const setCookies: { name: string; val: string; options: any }[] = [];
  const clearedCookies: { name: string; options: any }[] = [];
  let redirectUrl: string | null = null;
  let redirectStatus: number | null = null;

  const res = {
    status(code: number) {
      statusCode = code;
      return res;
    },
    send(data: any) {
      responseData = data;
      return res;
    },
    json(data: any) {
      responseData = data;
      return res;
    },
    cookie(name: string, val: string, options: any) {
      setCookies.push({ name, val, options });
      return res;
    },
    clearCookie(name: string, options: any) {
      clearedCookies.push({ name, options });
      return res;
    },
    redirect(statusOrUrl: number | string, url?: string) {
      if (typeof statusOrUrl === "number") {
        redirectStatus = statusOrUrl;
        redirectUrl = url!;
      } else {
        redirectStatus = 302;
        redirectUrl = statusOrUrl;
      }
      return res;
    },
  } as unknown as Response;

  return {
    req,
    res,
    get status() {
      return redirectStatus ?? statusCode;
    },
    get data() {
      return responseData;
    },
    get text() {
      return typeof responseData === "string" ? responseData : JSON.stringify(responseData);
    },
    get redirectUrl() {
      return redirectUrl;
    },
    get setCookies() {
      return setCookies;
    },
    get clearedCookies() {
      return clearedCookies;
    },
  };
}

describe("Passo D2 - Login com Google", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (ENV as any).googleClientId = "mock-client-id.apps.googleusercontent.com";
    (ENV as any).googleClientSecret = "mock-client-secret";
    (ENV as any).appUrl = "https://amopets.com.br";
    ENV.ownerOpenId = "owner-google-sub-999";
  });

  it("a) GET /api/auth/google responde 302 para accounts.google.com com parâmetros corretos e define 3 cookies (state, verifier, nonce)", async () => {
    const mock = createMockReqRes({ protocol: "https" });
    await handleGoogleAuth(mock.req, mock.res);

    expect(mock.status).toBe(302);
    expect(mock.redirectUrl).toBeTruthy();
    expect(mock.redirectUrl).toMatch(/^https:\/\/accounts\.google\.com/);

    const parsedUrl = new URL(mock.redirectUrl!);
    expect(parsedUrl.searchParams.get("client_id")).toBe("mock-client-id.apps.googleusercontent.com");
    expect(parsedUrl.searchParams.get("redirect_uri")).toBe("https://amopets.com.br/api/auth/google/callback");
    expect(parsedUrl.searchParams.get("response_type")).toBe("code");
    expect(parsedUrl.searchParams.get("scope")).toContain("openid");
    expect(parsedUrl.searchParams.get("scope")).toContain("email");
    expect(parsedUrl.searchParams.get("scope")).toContain("profile");
    expect(parsedUrl.searchParams.get("code_challenge")).toBe("mock-code-challenge-string-1234567890");
    expect(parsedUrl.searchParams.get("code_challenge_method")).toBe("S256");

    const stateParam = parsedUrl.searchParams.get("state");
    const nonceParam = parsedUrl.searchParams.get("nonce");
    expect(stateParam).toBeTruthy();
    expect(nonceParam).toBeTruthy();

    expect(mock.setCookies).toHaveLength(3);
    const stateCookie = mock.setCookies.find((c) => c.name === GOOGLE_AUTH_STATE_COOKIE);
    const verifierCookie = mock.setCookies.find((c) => c.name === GOOGLE_AUTH_VERIFIER_COOKIE);
    const nonceCookie = mock.setCookies.find((c) => c.name === GOOGLE_AUTH_NONCE_COOKIE);

    expect(stateCookie).toBeDefined();
    expect(verifierCookie).toBeDefined();
    expect(nonceCookie).toBeDefined();

    expect(stateCookie!.val).toBe(stateParam);
    expect(verifierCookie!.val).toBe("mock-code-verifier-string-1234567890");
    expect(nonceCookie!.val).toBe(nonceParam);

    for (const c of [stateCookie!, verifierCookie!, nonceCookie!]) {
      expect(c.options.httpOnly).toBe(true);
      expect(c.options.sameSite.toLowerCase()).toBe("lax");
      expect(c.options.path).toBe("/api/auth/google");
      expect(c.options.maxAge).toBe(10 * 60 * 1000);
      expect(c.options.secure).toBe(true); // Requisição HTTPS
    }
  });

  it("b) callback sem os cookies: 400", async () => {
    const mock = createMockReqRes({
      query: { code: "some-code", state: "some-state" },
    });
    await handleGoogleAuthCallback(mock.req, mock.res);

    expect(mock.status).toBe(400);
    expect(mock.text).toContain("Resposta de autenticação inválida.");
  });

  it("c) callback com state diferente do cookie: 400", async () => {
    const mock = createMockReqRes({
      query: { code: "some-code", state: "state-received-from-google" },
      headers: {
        cookie: `${GOOGLE_AUTH_STATE_COOKIE}=different-state; ${GOOGLE_AUTH_VERIFIER_COOKIE}=mock-verif; ${GOOGLE_AUTH_NONCE_COOKIE}=mock-nonce`,
      },
    });
    await handleGoogleAuthCallback(mock.req, mock.res);

    expect(mock.status).toBe(400);
    expect(mock.text).toContain("Resposta de autenticação inválida.");
  });

  it("d) ID token com nonce diferente do cookie: 400", async () => {
    mockVerifyIdToken.mockResolvedValueOnce({
      getPayload: () => ({
        sub: "mock-sub-12345",
        email: "cliente@gmail.com",
        email_verified: true,
        name: "Maria Silva",
        nonce: "wrong-nonce-from-token",
      }),
    });

    const mock = createMockReqRes({
      query: { code: "some-code", state: "matching-state" },
      headers: {
        cookie: `${GOOGLE_AUTH_STATE_COOKIE}=matching-state; ${GOOGLE_AUTH_VERIFIER_COOKIE}=mock-code-verifier-string-1234567890; ${GOOGLE_AUTH_NONCE_COOKIE}=correct-cookie-nonce`,
      },
    });
    await handleGoogleAuthCallback(mock.req, mock.res);

    expect(mock.status).toBe(400);
    expect(mock.text).toContain("Resposta de autenticação inválida.");
  });

  it("e) email_verified diferente de true: 403", async () => {
    mockVerifyIdToken.mockResolvedValueOnce({
      getPayload: () => ({
        sub: "mock-sub-12345",
        email: "cliente@gmail.com",
        email_verified: false,
        name: "Maria Silva",
        nonce: "matching-nonce",
      }),
    });

    const mock = createMockReqRes({
      query: { code: "some-code", state: "matching-state" },
      headers: {
        cookie: `${GOOGLE_AUTH_STATE_COOKIE}=matching-state; ${GOOGLE_AUTH_VERIFIER_COOKIE}=mock-code-verifier-string-1234567890; ${GOOGLE_AUTH_NONCE_COOKIE}=matching-nonce`,
      },
    });
    await handleGoogleAuthCallback(mock.req, mock.res);

    expect(mock.status).toBe(403);
    expect(mock.text).toContain("A conta Google precisa ter e-mail verificado.");
  });

  it("f) sucesso: cria ou atualiza users com openId = 'google:' + sub, role = 'user', define COOKIE_NAME com 30 dias, apaga os 3 cookies e redireciona para '/'", async () => {
    mockVerifyIdToken.mockResolvedValueOnce({
      getPayload: () => ({
        sub: "1234567890",
        email: "cliente@gmail.com",
        email_verified: true,
        name: "Maria Silva",
        nonce: "valid-nonce-abc",
      }),
    });

    const mock = createMockReqRes({
      query: { code: "valid-auth-code", state: "valid-state-abc" },
      headers: {
        cookie: `${GOOGLE_AUTH_STATE_COOKIE}=valid-state-abc; ${GOOGLE_AUTH_VERIFIER_COOKIE}=mock-code-verifier-string-1234567890; ${GOOGLE_AUTH_NONCE_COOKIE}=valid-nonce-abc`,
      },
      protocol: "https",
    });
    await handleGoogleAuthCallback(mock.req, mock.res);

    expect(mock.status).toBe(302);
    expect(mock.redirectUrl).toBe("/");

    // Verifica db.upsertUser
    expect(db.upsertUser).toHaveBeenCalledWith(
      expect.objectContaining({
        openId: "google:1234567890",
        name: "Maria Silva",
        email: "cliente@gmail.com",
        loginMethod: "google",
        role: "user",
      })
    );

    // Verifica cookie de sessão
    const sessionCookie = mock.setCookies.find((c) => c.name === COOKIE_NAME);
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie!.options.maxAge).toBe(SESSION_DURATION_MS);
    expect(sessionCookie!.options.httpOnly).toBe(true);
    expect(sessionCookie!.options.path).toBe("/");

    // Verifica limpeza dos 3 cookies temporários
    const clearedNames = mock.clearedCookies.map((c) => c.name);
    expect(clearedNames).toContain(GOOGLE_AUTH_STATE_COOKIE);
    expect(clearedNames).toContain(GOOGLE_AUTH_VERIFIER_COOKIE);
    expect(clearedNames).toContain(GOOGLE_AUTH_NONCE_COOKIE);
    for (const c of mock.clearedCookies) {
      expect(c.options.path).toBe("/api/auth/google");
    }
  });

  it("g) se o usuário já existe, o login NÃO altera o role dele, e nenhum caminho promove alguém a admin", async () => {
    // 1. Mesmo se sub bater com OWNER_OPEN_ID, o login deve manter role: 'user'
    mockVerifyIdToken.mockResolvedValueOnce({
      getPayload: () => ({
        sub: "owner-google-sub-999",
        email: "owner@amopets.com.br",
        email_verified: true,
        name: "Owner",
        nonce: "nonce-owner",
      }),
    });

    const mock = createMockReqRes({
      query: { code: "code-owner", state: "state-owner" },
      headers: {
        cookie: `${GOOGLE_AUTH_STATE_COOKIE}=state-owner; ${GOOGLE_AUTH_VERIFIER_COOKIE}=mock-code-verifier-string-1234567890; ${GOOGLE_AUTH_NONCE_COOKIE}=nonce-owner`,
      },
    });
    await handleGoogleAuthCallback(mock.req, mock.res);

    expect(db.upsertUser).toHaveBeenCalledWith(
      expect.objectContaining({
        openId: "google:owner-google-sub-999",
        role: "user",
      })
    );
    expect(db.upsertUser).not.toHaveBeenCalledWith(
      expect.objectContaining({
        role: "admin",
      })
    );
  });

  it("h) sem GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET ou APP_URL: a rota inicial responde 503 com mensagem clara", async () => {
    (ENV as any).googleClientId = "";
    const mock = createMockReqRes({});
    await handleGoogleAuth(mock.req, mock.res);

    expect(mock.status).toBe(503);
    expect(mock.text).toContain("Login com Google não configurado.");
  });

  it("i) parâmetro error=access_denied do Google: apaga os cookies e redireciona sem detalhes", async () => {
    const mock = createMockReqRes({
      query: { error: "access_denied" },
      headers: {
        cookie: `${GOOGLE_AUTH_STATE_COOKIE}=st; ${GOOGLE_AUTH_VERIFIER_COOKIE}=vf; ${GOOGLE_AUTH_NONCE_COOKIE}=nc`,
      },
    });
    await handleGoogleAuthCallback(mock.req, mock.res);

    expect(mock.status).toBe(302);
    expect(mock.redirectUrl).toBe("/");

    const clearedNames = mock.clearedCookies.map((c) => c.name);
    expect(clearedNames).toContain(GOOGLE_AUTH_STATE_COOKIE);
    expect(clearedNames).toContain(GOOGLE_AUTH_VERIFIER_COOKIE);
    expect(clearedNames).toContain(GOOGLE_AUTH_NONCE_COOKIE);
  });

  it("j) nenhum console.log ou console.error contém code, state, e-mail, nome ou tokens", async () => {
    const logSpy = vi.spyOn(console, "log");
    const warnSpy = vi.spyOn(console, "warn");
    const errorSpy = vi.spyOn(console, "error");

    const sensitiveValues = [
      "secret-auth-code-12345",
      "secret-state-token-67890",
      "confidential.user@gmail.com",
      "Super Secret User",
      "mock-valid-id-token-abc",
    ];

    // Executa fluxo inicial
    const mockStart = createMockReqRes({ protocol: "https" });
    await handleGoogleAuth(mockStart.req, mockStart.res);

    // Executa fluxo de erro
    const mockErr = createMockReqRes({
      query: { code: "secret-auth-code-12345", state: "secret-state-token-67890" },
      headers: {
        cookie: `${GOOGLE_AUTH_STATE_COOKIE}=other-state; ${GOOGLE_AUTH_VERIFIER_COOKIE}=verif; ${GOOGLE_AUTH_NONCE_COOKIE}=nonce`,
      },
    });
    await handleGoogleAuthCallback(mockErr.req, mockErr.res);

    // Executa fluxo com sucesso
    mockVerifyIdToken.mockResolvedValueOnce({
      getPayload: () => ({
        sub: "sub-confidential",
        email: "confidential.user@gmail.com",
        email_verified: true,
        name: "Super Secret User",
        nonce: "matching-nonce-xyz",
      }),
    });
    const mockOk = createMockReqRes({
      query: { code: "secret-auth-code-12345", state: "secret-state-token-67890" },
      headers: {
        cookie: `${GOOGLE_AUTH_STATE_COOKIE}=secret-state-token-67890; ${GOOGLE_AUTH_VERIFIER_COOKIE}=mock-code-verifier-string-1234567890; ${GOOGLE_AUTH_NONCE_COOKIE}=matching-nonce-xyz`,
      },
    });
    await handleGoogleAuthCallback(mockOk.req, mockOk.res);

    const allLogs = [
      ...logSpy.mock.calls,
      ...warnSpy.mock.calls,
      ...errorSpy.mock.calls,
    ].flat().map(String);

    for (const logLine of allLogs) {
      for (const sensitive of sensitiveValues) {
        expect(logLine).not.toContain(sensitive);
      }
    }
  });

  it("rotas registradas: GET /api/auth/google e GET /api/auth/google/callback", () => {
    const app = express();
    registerGoogleAuthRoutes(app);
    const routes = app._router.stack
      .filter((layer: any) => layer.route)
      .map((layer: any) => layer.route.path);
    expect(routes).toContain("/api/auth/google");
    expect(routes).toContain("/api/auth/google/callback");
  });
});
