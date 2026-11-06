import { describe, expect, it, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { registerUploadRoutes, BUNDLED_UPLOAD_DIR, getUploadDir, deleteUploadedFileSafe, UUID_WEBP_REGEX } from "./uploadRoutes";

describe("Persistência de Uploads (Configurável via UPLOAD_DIR)", () => {
  const originalUploadDir = process.env.UPLOAD_DIR;
  let tempDir: string | null = null;

  afterEach(async () => {
    if (originalUploadDir !== undefined) {
      process.env.UPLOAD_DIR = originalUploadDir;
    } else {
      delete process.env.UPLOAD_DIR;
    }

    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
      tempDir = null;
    }
  });

  it("a) por padrão, getUploadDir() retorna BUNDLED_UPLOAD_DIR se UPLOAD_DIR não estiver configurado", () => {
    delete process.env.UPLOAD_DIR;
    expect(getUploadDir()).toBe(BUNDLED_UPLOAD_DIR);
  });

  it("b) quando UPLOAD_DIR estiver configurado, getUploadDir() resolve o caminho personalizado ou expande ~/", async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "amopets-uploads-"));
    process.env.UPLOAD_DIR = tempDir;

    expect(getUploadDir()).toBe(path.resolve(tempDir));

    // Testa suporte a ~/
    process.env.UPLOAD_DIR = "~/uploads";
    expect(getUploadDir()).toBe(path.resolve(os.homedir(), "uploads"));
  });

  it("c) serve arquivos do UPLOAD_DIR personalizado e faz fallback para o diretório padrão se o arquivo for do repositório", async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "amopets-uploads-"));
    process.env.UPLOAD_DIR = tempDir;

    // Cria um arquivo fictício no UPLOAD_DIR personalizado
    const customFileName = "imagem-personalizada.webp";
    const customContent = Buffer.from("RIFF\x00\x00\x00\x00WEBPVP8 custom-content");
    await fs.writeFile(path.join(tempDir, customFileName), customContent);

    const app = express();
    registerUploadRoutes(app);

    // 1. Arquivo novo na pasta persistente personalizada deve ser servido
    const resCustom = await request(app).get(`/uploads/${customFileName}`);
    expect(resCustom.status).toBe(200);
    expect(resCustom.headers["x-content-type-options"]).toBe("nosniff");
    expect(resCustom.headers["cache-control"]).toBe("public, max-age=86400");

    // 2. Arquivo fixo do repositório (ex: pets-hero.webp) que NÃO está na pasta personalizada deve ser servido via fallback
    const resFallback = await request(app).get("/uploads/pets-hero.webp");
    expect(resFallback.status).toBe(200);

    // 3. Arquivo inexistente em ambos deve responder 404
    const resNotFound = await request(app).get("/uploads/arquivo-inexistente.webp");
    expect(resNotFound.status).toBe(404);
  });

  it("d) deleteUploadedFileSafe protege arquivos do repositório/seed e apenas apaga arquivos UUID reais", async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "amopets-uploads-"));
    process.env.UPLOAD_DIR = tempDir;

    // 1. Arquivo do repositório (não-UUID) NÃO deve ser apagado
    const protectedName = "prod01_01.webp";
    await fs.writeFile(path.join(tempDir, protectedName), "content");
    const resultProtected = await deleteUploadedFileSafe(`/uploads/${protectedName}`);
    expect(resultProtected).toBe(false);
    // Arquivo continua existindo
    await expect(fs.access(path.join(tempDir, protectedName))).resolves.toBeUndefined();

    // 2. Arquivo com nome UUID DEVE ser apagado
    const uuidName = "550e8400-e29b-41d4-a716-446655440000.webp";
    await fs.writeFile(path.join(tempDir, uuidName), "content");
    const resultUuid = await deleteUploadedFileSafe(`/uploads/${uuidName}`);
    expect(resultUuid).toBe(true);
    // Arquivo foi removido do disco
    await expect(fs.access(path.join(tempDir, uuidName))).rejects.toThrow();

    // 3. Arquivo inexistente não estoura exceção e retorna true/resiliente
    const nonExistentUuid = "660e8400-e29b-41d4-a716-446655440000.webp";
    await expect(deleteUploadedFileSafe(`/uploads/${nonExistentUuid}`)).resolves.toBe(true);
  });
});

