import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";
import { COOKIE_NAME } from "../shared/const";
import * as db from "./db";
import { sdk } from "./_core/sdk";
import {
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
  return `https://accounts.google.com/o/oauth2/v2/auth?state=${opts.state}&nonce=${opts.nonce}`;
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
      getToken = vi.fn();
      verifyIdToken = vi.fn();
      constructor(_opts?: any) {}
    },
  };
});

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getUserByOpenId: vi.fn(),
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
  const responseHeaders: Record<string, string> = {};
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
    setHeader(name: string, val: string) {
      responseHeaders[name.toLowerCase()] = val;
      return res;
    },
    header(name: string, val: string) {
      responseHeaders[name.toLowerCase()] = val;
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
    get headers() {
      return responseHeaders;
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

describe("Passo D3 - Limpeza Manus OAuth e Ajustes Google Auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("a) o app NÃO registra GET /api/oauth/callback (rota removida)", async () => {
    let oauthModuleFound = true;
    try {
      await import("./_core/oauth");
    } catch {
      oauthModuleFound = false;
    }
    expect(oauthModuleFound).toBe(false);
  });

  it("b) authenticateRequest ignora o cabeçalho Authorization: Bearer (sem cookie, resulta em null)", async () => {
    const validUser = {
      id: 99,
      openId: "valid-bearer-open-id",
      name: "Bearer Client",
      email: "bearer@test.com",
      loginMethod: "google",
      role: "user" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };
    vi.mocked(db.getUserByOpenId).mockResolvedValue(validUser);

    const validToken = await sdk.signSession({
      openId: validUser.openId,
      appId: "test-app",
      name: validUser.name,
    });
    const req = {
      headers: {
        authorization: `Bearer ${validToken}`,
      },
      protocol: "http",
    } as unknown as Request;

    const authenticatedUser = await sdk.authenticateRequest(req);
    expect(authenticatedUser).toBeNull();
  });

  it("c) token válido cujo openId começa com o prefixo de cron_: não autentica e NENHUMA chamada de rede é feita", async () => {
    vi.mocked(db.getUserByOpenId).mockResolvedValue(null);
    const postSpy = (sdk as any).client ? vi.spyOn((sdk as any).client, "post").mockRejectedValue(new Error("Should not be called")) : null;
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const cronToken = await sdk.signSession({
      openId: "cron_daily_backup",
      appId: "test-app",
      name: "Cron Job",
    });

    const req = {
      headers: {
        cookie: `${COOKIE_NAME}=${cronToken}`,
      },
      protocol: "http",
    } as unknown as Request;

    const user = await sdk.authenticateRequest(req).catch(() => null);
    expect(user).toBeNull();
    if (postSpy) {
      expect(postSpy).not.toHaveBeenCalled();
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("d) sdk não possui oauthService nem cria cliente HTTP para api.manus.im", () => {
    expect((sdk as any).oauthService).toBeUndefined();
    expect((sdk as any).client).toBeUndefined();
  });

  it("e) handleGoogleAuth: se generateCodeVerifierAsync rejeitar, responde 500 com mensagem genérica", async () => {
    mockGenerateCodeVerifierAsync.mockRejectedValueOnce(new Error("Crypto error during PKCE generation"));

    const mock = createMockReqRes({ protocol: "https" });
    await handleGoogleAuth(mock.req, mock.res);

    expect(mock.status).toBe(500);
    expect(mock.text).toContain("Não foi possível iniciar o login com Google.");
  });

  it("f) as respostas de /api/auth/google e /api/auth/google/callback incluem Cache-Control: no-store", async () => {
    const mockAuth = createMockReqRes({ protocol: "https" });
    await handleGoogleAuth(mockAuth.req, mockAuth.res);
    expect(mockAuth.headers["cache-control"]).toBe("no-store");

    const mockCb = createMockReqRes({
      query: { error: "access_denied" },
    });
    await handleGoogleAuthCallback(mockCb.req, mockCb.res);
    expect(mockCb.headers["cache-control"]).toBe("no-store");
  });
});
