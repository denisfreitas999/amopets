import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { hashAdminPassword } from "./adminAuth";

vi.mock("./adminAuth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./adminAuth")>();
  return {
    ...actual,
    getAdminByUsername: vi.fn(),
    markAdminLogin: vi.fn(),
    verifyAdminPassword: vi.fn(actual.verifyAdminPassword),
  };
});

import { getAdminByUsername, verifyAdminPassword } from "./adminAuth";

const testPassword = "SenhaCorreta#2026";
const testPasswordHash = hashAdminPassword(testPassword);

const mockActiveAdmin = {
  id: 1,
  name: "Administrador Teste",
  username: "admin@amopets.com.br",
  passwordHash: testPasswordHash,
  active: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastLoginAt: null,
};

const mockInactiveAdmin = {
  ...mockActiveAdmin,
  id: 2,
  username: "inativo@amopets.com.br",
  active: false,
};

const mockOtherAdmin = {
  ...mockActiveAdmin,
  id: 3,
  username: "outro@amopets.com.br",
};

function createCaller(ip?: string) {
  const req = {
    ip,
    headers: {},
    cookies: {},
    protocol: "http",
  } as unknown as Request;
  const res = {
    cookie: vi.fn(),
    clearCookie: vi.fn(),
  } as unknown as Response;

  const ctx: TrpcContext = {
    req,
    res,
    user: null,
    admin: null,
    adminSession: false,
  };

  return appRouter.createCaller(ctx);
}

describe("Limite de tentativas no login admin (Passo C2)", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.mocked(getAdminByUsername).mockImplementation(async (username: string) => {
      if (username === "admin@amopets.com.br") return mockActiveAdmin;
      if (username === "inativo@amopets.com.br") return mockInactiveAdmin;
      if (username === "outro@amopets.com.br") return mockOtherAdmin;
      return null;
    });

    try {
      const rateLimitModule = await import("./adminRateLimit");
      rateLimitModule.resetAllRateLimits();
    } catch {
      // módulo ainda não implementado na Etapa 1
    }
  });

  it("a) 5 senhas erradas seguidas retornam 401 com mensagem genérica; a 6ª retorna 429", async () => {
    const caller = createCaller("192.168.1.100");

    for (let i = 0; i < 5; i++) {
      const err = await caller.admin.auth
        .login({
          username: "admin@amopets.com.br",
          password: "SenhaErrada#999",
        })
        .catch((e) => e);

      expect(err).toMatchObject({
        code: "UNAUTHORIZED",
        message: "Usuário ou senha inválidos.",
      });
    }

    const sixthAttempt = await caller.admin.auth
      .login({
        username: "admin@amopets.com.br",
        password: "SenhaErrada#999",
      })
      .catch((e) => e);

    expect(sixthAttempt).toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });
  });

  it("b) passada a janela de 15 minutos (use timers falsos do vitest), o login correto volta a funcionar", async () => {
    vi.useFakeTimers();
    try {
      const caller = createCaller("192.168.1.101");

      for (let i = 0; i < 5; i++) {
        await expect(
          caller.admin.auth.login({
            username: "admin@amopets.com.br",
            password: "SenhaErrada#999",
          })
        ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      }

      await expect(
        caller.admin.auth.login({
          username: "admin@amopets.com.br",
          password: "SenhaCorreta#2026",
        })
      ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });

      // Avança 15 minutos e 1 segundo
      vi.advanceTimersByTime(15 * 60 * 1000 + 1000);

      const result = await caller.admin.auth.login({
        username: "admin@amopets.com.br",
        password: "SenhaCorreta#2026",
      });

      expect(result).toMatchObject({
        id: 1,
        username: "admin@amopets.com.br",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("c) o limite vale por IP e também por usuário", async () => {
    // Caso 1: limite por IP bloqueia outro usuário no mesmo IP
    const callerIp1 = createCaller("10.0.0.1");
    for (let i = 0; i < 5; i++) {
      await expect(
        callerIp1.admin.auth.login({
          username: "admin@amopets.com.br",
          password: "SenhaErrada#999",
        })
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    }

    // Outro usuário no mesmo IP continua bloqueado pelo IP
    await expect(
      callerIp1.admin.auth.login({
        username: "outro@amopets.com.br",
        password: "SenhaCorreta#2026",
      })
    ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });

    // Caso 2: mesmo usuário vindo de outro IP continua bloqueado pelo usuário
    const callerIp2 = createCaller("10.0.0.2");
    for (let i = 0; i < 5; i++) {
      await expect(
        callerIp2.admin.auth.login({
          username: "outro@amopets.com.br",
          password: "SenhaErrada#999",
        })
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    }

    const callerIp3 = createCaller("10.0.0.3");
    // O mesmo usuário vindo de outro IP continua bloqueado pelo usuário
    await expect(
      callerIp3.admin.auth.login({
        username: "outro@amopets.com.br",
        password: "SenhaCorreta#2026",
      })
    ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });

  it("d) usuário inexistente, senha errada e admin inativo retornam exatamente a mesma mensagem", async () => {
    const caller = createCaller("10.0.1.1");

    const errInexistente = await caller.admin.auth
      .login({
        username: "inexistente@amopets.com.br",
        password: "SenhaQualquer#123",
      })
      .catch((e) => e);

    const errSenha = await caller.admin.auth
      .login({
        username: "admin@amopets.com.br",
        password: "SenhaErrada#123",
      })
      .catch((e) => e);

    const errInativo = await caller.admin.auth
      .login({
        username: "inativo@amopets.com.br",
        password: "SenhaCorreta#2026",
      })
      .catch((e) => e);

    expect(errInexistente).toMatchObject({
      code: "UNAUTHORIZED",
      message: "Usuário ou senha inválidos.",
    });
    expect(errSenha).toMatchObject({
      code: "UNAUTHORIZED",
      message: "Usuário ou senha inválidos.",
    });
    expect(errInativo).toMatchObject({
      code: "UNAUTHORIZED",
      message: "Usuário ou senha inválidos.",
    });
    expect(errInexistente.message).toBe(errSenha.message);
    expect(errSenha.message).toBe(errInativo.message);
  });

  it("e) um login correto zera os contadores de falha daquele usuário e daquele IP", async () => {
    const caller = createCaller("10.0.2.1");

    // 4 falhas seguidas (quase no limite)
    for (let i = 0; i < 4; i++) {
      await expect(
        caller.admin.auth.login({
          username: "admin@amopets.com.br",
          password: "SenhaErrada#999",
        })
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    }

    // Login correto com sucesso
    const success = await caller.admin.auth.login({
      username: "admin@amopets.com.br",
      password: "SenhaCorreta#2026",
    });
    expect(success).toMatchObject({ username: "admin@amopets.com.br" });

    // Após login correto com sucesso, contadores foram zerados: 4 novas falhas ainda retornam 401 (não 429)
    for (let i = 0; i < 4; i++) {
      await expect(
        caller.admin.auth.login({
          username: "admin@amopets.com.br",
          password: "SenhaErrada#999",
        })
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    }
  });

  it("f) se o IP não puder ser determinado, usa a chave 'unknown' em vez de falhar", async () => {
    const callerNoIp = createCaller(undefined);

    for (let i = 0; i < 5; i++) {
      await expect(
        callerNoIp.admin.auth.login({
          username: "admin@amopets.com.br",
          password: "SenhaErrada#999",
        })
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    }

    await expect(
      callerNoIp.admin.auth.login({
        username: "admin@amopets.com.br",
        password: "SenhaErrada#999",
      })
    ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });

  it("C2.1 - normaliza a chave por usuário com trim e minúsculas", async () => {
    const caller = createCaller("192.168.1.180");

    for (let i = 0; i < 5; i++) {
      await expect(
        caller.admin.auth.login({
          username: "  ADMIN@AmoPets.com.br  ",
          password: "SenhaErrada#999",
        })
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    }

    const callerOtherIp = createCaller("192.168.1.181");
    await expect(
      callerOtherIp.admin.auth.login({
        username: "admin@amopets.com.br",
        password: "SenhaCorreta#2026",
      })
    ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });

  it("C2.1 - expira chaves fora da janela a cada consulta e limita o Map a no máximo 10.000 chaves", async () => {
    vi.useFakeTimers();
    try {
      const rateLimitModule = await import("./adminRateLimit");
      rateLimitModule.resetAllRateLimits();

      rateLimitModule.recordLoginFailure("10.99.99.1", "test@amopets.com.br");
      expect(rateLimitModule.getRateLimitMapSizes().userCount).toBe(1);

      vi.advanceTimersByTime(15 * 60 * 1000 + 1000);

      rateLimitModule.checkLoginRateLimit("10.99.99.1", "test@amopets.com.br");
      expect(rateLimitModule.getRateLimitMapSizes().userCount).toBe(0);

      for (let i = 0; i < 10050; i++) {
        rateLimitModule.recordLoginFailure(`10.0.0.${i}`, `user${i}@amopets.com.br`);
      }
      const sizes = rateLimitModule.getRateLimitMapSizes();
      expect(sizes.userCount).toBeLessThanOrEqual(10000);
      expect(sizes.ipCount).toBeLessThanOrEqual(10000);
    } finally {
      vi.useRealTimers();
    }
  });

  it("C2.1 - consulta o limite antes de executar o scrypt (não chama verifyAdminPassword se bloqueado)", async () => {
    const caller = createCaller("192.168.1.190");

    for (let i = 0; i < 5; i++) {
      await expect(
        caller.admin.auth.login({
          username: "admin@amopets.com.br",
          password: "SenhaErrada#999",
        })
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    }

    vi.mocked(verifyAdminPassword).mockClear();

    await expect(
      caller.admin.auth.login({
        username: "admin@amopets.com.br",
        password: "SenhaCorreta#2026",
      })
    ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });

    expect(verifyAdminPassword).not.toHaveBeenCalled();
  });

  it("C2.1 - se o usuário não existir, executa verifyAdminPassword contra hash fixo de mentira", async () => {
    const caller = createCaller("192.168.1.195");
    vi.mocked(verifyAdminPassword).mockClear();

    await expect(
      caller.admin.auth.login({
        username: "naoexiste@amopets.com.br",
        password: "SenhaQualquer#123",
      })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });

    expect(verifyAdminPassword).toHaveBeenCalledTimes(1);
    expect(verifyAdminPassword).toHaveBeenCalledWith(
      "SenhaQualquer#123",
      expect.stringMatching(/^scrypt\$[0-9a-fA-F]+\$[0-9a-fA-F]+$/)
    );
  });
});

