/**
 * Passo H4c – Testes de Higiene, auth.me, Tratador de Erros, Stack tRPC e Datas BR
 */

import { describe, expect, it, afterEach } from "vitest";
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import request from "supertest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeCtx(user: TrpcContext["user"] = null): TrpcContext {
  return {
    user,
    admin: null,
    adminSession: false,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

// ─── a) Higiene Manus ─────────────────────────────────────────────────────────

describe("H4c-a: Higiene Manus nos arquivos rastreados (exceto docs/ e pnpm-lock.yaml)", () => {
  it("nenhum arquivo rastreado existente (fora de docs/, pnpm-lock.yaml e .gitignore) contém 'manus' no conteúdo", () => {
    const root = path.resolve(import.meta.dirname, "..");
    let output: string;
    try {
      output = execSync("git ls-files", { cwd: root, encoding: "utf8" });
    } catch {
      output = "";
    }
    const files = output
      .split("\n")
      .map((f) => f.trim())
      .filter(
        (f) =>
          f &&
          !f.startsWith("docs/") &&
          f !== "pnpm-lock.yaml" &&
          f !== ".gitignore" &&
          f !== "server/h4c.test.ts"
      );

    const hits: string[] = [];
    for (const rel of files) {
      const abs = path.join(root, rel);
      if (!existsSync(abs)) continue;
      try {
        const content: string = readFileSync(abs, "utf8");
        if (/manus/i.test(content)) hits.push(rel);
      } catch {
        // arquivo pode não ter permissão de leitura
      }
    }
    expect(hits, `Arquivos com 'manus': ${hits.join(", ")}`).toEqual([]);
  });

  it(".gitignore contém '.manus/' e '.manus-logs/'", () => {
    const root = path.resolve(import.meta.dirname, "..");
    const gitignore: string = readFileSync(path.join(root, ".gitignore"), "utf8");
    expect(gitignore).toContain(".manus/");
    expect(gitignore).toContain(".manus-logs/");
  });

  it("a pasta .manus não existe", () => {
    const root = path.resolve(import.meta.dirname, "..");
    expect(existsSync(path.join(root, ".manus"))).toBe(false);
  });
});

// ─── b) auth.me ───────────────────────────────────────────────────────────────

describe("H4c-b: auth.me retorna exatamente { name } ou null", () => {
  it("usuário logado recebe exatamente { name }", async () => {
    const user = {
      id: 1,
      openId: "google_abc",
      email: "test@example.com",
      name: "João Silva",
      loginMethod: "google",
      role: "user" as const,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };
    const caller = appRouter.createCaller(makeCtx(user));
    const result = await caller.auth.me();
    // Deve ter EXATAMENTE só { name } — sem email, id, openId, role, etc.
    expect(result).toEqual({ name: "João Silva" });
  });

  it("usuário anônimo recebe null", async () => {
    const caller = appRouter.createCaller(makeCtx(null));
    const result = await caller.auth.me();
    expect(result).toBeNull();
  });
});

// ─── c) NODE_ENV != development → sem data.stack ────────────────────────────

describe("H4c-c: errorFormatter remove data.stack fora de development", () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it("em NODE_ENV=test a resposta de erro tRPC não inclui data.stack", async () => {
    process.env.NODE_ENV = "test";
    const { createApp, installErrorHandler } = await import("./_core/index");
    const app = createApp();
    installErrorHandler(app);

    const res = await request(app).get("/api/trpc/account.orders");

    expect(res.status).toBe(401);
    const errorData = res.body?.error?.json?.data ?? res.body?.error?.data;
    expect(errorData).toBeDefined();
    expect(errorData).not.toHaveProperty("stack");
  });

  it("em NODE_ENV=production a resposta de erro tRPC não inclui data.stack", async () => {
    process.env.NODE_ENV = "production";
    const { createApp, installErrorHandler } = await import("./_core/index");
    const app = createApp();
    installErrorHandler(app);

    const res = await request(app).get("/api/trpc/account.orders");

    expect(res.status).toBe(401);
    const errorData = res.body?.error?.json?.data ?? res.body?.error?.data;
    expect(errorData).toBeDefined();
    expect(errorData).not.toHaveProperty("stack");
  });
});

// ─── d) Rota registrada DEPOIS de createApp() é coberta pelo tratador ─────────

describe("H4c-d: installErrorHandler captura erros de rotas adicionadas após createApp()", () => {
  it("se a rota tardia é registrada após createApp(), só é tratada com JSON genérico se installErrorHandler for chamado DEPOIS dela", async () => {
    process.env.NODE_ENV = "test";
    const { createApp, installErrorHandler } = await import("./_core/index");

    // 1. Ordem antiga/incorreta: tratador montado ANTES da rota tardia (ex.: dentro de createApp)
    const appEarly = createApp();
    installErrorHandler(appEarly);
    appEarly.get("/test-early-error", () => {
      throw new Error("erro rota tardia sem tratador posterior");
    });

    const resEarly = await request(appEarly).get("/test-early-error");
    expect(resEarly.headers["content-type"]).toContain("text/html");
    expect(resEarly.body).not.toHaveProperty("message");

    // 2. Ordem correta: installErrorHandler montado DEPOIS da rota tardia
    const appLate = createApp();
    appLate.get("/test-late-error", () => {
      throw new Error("erro rota tardia com tratador posterior");
    });
    installErrorHandler(appLate);

    const resLate = await request(appLate).get("/test-late-error");
    expect(resLate.status).toBe(500);
    expect(resLate.headers["content-type"]).toContain("application/json");
    expect(resLate.body).toEqual({ message: "Ocorreu um erro interno. Tente novamente." });
    expect(resLate.body).not.toHaveProperty("stack");
    expect(JSON.stringify(resLate.body)).not.toContain("erro rota tardia com tratador posterior");
  });
});

// ─── e) shared/dateFormat.ts ─────────────────────────────────────────────────

describe("H4c-e: formatDateTimeBR e formatDateBR respeitam America/Sao_Paulo", () => {
  // 2026-10-15T02:30:00Z = 14/10/2026 23:30 em São Paulo (UTC-3)
  const utcDate = new Date("2026-10-15T02:30:00Z");

  it("formatDateTimeBR devolve '14/10/2026 23:30' independente do TZ do ambiente", async () => {
    const { formatDateTimeBR } = await import("../shared/dateFormat");
    expect(formatDateTimeBR(utcDate)).toBe("14/10/2026 23:30");
  });

  it("formatDateBR devolve '14/10/2026' independente do TZ do ambiente", async () => {
    const { formatDateBR } = await import("../shared/dateFormat");
    expect(formatDateBR(utcDate)).toBe("14/10/2026");
  });
});

// ─── f) system.notifyOwner removido; /api/health ok ─────────────────────────

describe("H4c-f: system.notifyOwner removido; /api/health presente", () => {
  it("system.notifyOwner não existe no appRouter (NOT_FOUND ao chamar)", async () => {
    const { createApp, installErrorHandler } = await import("./_core/index");
    const app = createApp();
    installErrorHandler(app);

    const res = await request(app)
      .post("/api/trpc/system.notifyOwner")
      .set("Content-Type", "application/json")
      .send({ json: { title: "test", content: "test" } });

    // tRPC retorna 404 (NOT_FOUND) para procedimento inexistente
    expect(res.status).toBe(404);
  });

  it("GET /api/health continua respondendo 200", async () => {
    const { createApp, installErrorHandler } = await import("./_core/index");
    const app = createApp();
    installErrorHandler(app);

    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true });
  });
});
