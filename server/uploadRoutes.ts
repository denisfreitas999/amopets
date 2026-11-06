import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import os from "node:os";
import type { Express, Request, Response } from "express";
import multer from "multer";
import { getAdminByRequest } from "./adminAuth";

export const BUNDLED_UPLOAD_DIR = path.resolve(process.cwd(), "uploads");

export function getUploadDir(): string {
  if (!process.env.UPLOAD_DIR) return BUNDLED_UPLOAD_DIR;
  const raw = process.env.UPLOAD_DIR.trim();
  if (raw.startsWith("~/") || raw === "~") {
    return path.resolve(os.homedir(), raw.replace(/^~[/\\]?/, ""));
  }
  return path.resolve(raw);
}

export const UPLOAD_DIR = BUNDLED_UPLOAD_DIR;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024, files: 10 },
  fileFilter: (_req, file, callback) => {
    const validName = path.extname(file.originalname).toLowerCase() === ".webp";
    (callback as unknown as (error: Error | null, acceptFile?: boolean) => void)(validName && file.mimetype === "image/webp" ? null : new Error("Apenas imagens WebP são aceitas."), validName && file.mimetype === "image/webp");
  },
});

function isWebp(buffer: Buffer) {
  return buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
}

export const UUID_WEBP_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/i;

/**
 * Remove com segurança um arquivo de upload gerado dinamicamente pelo sistema.
 * - REGRA 1: Somente exclui arquivos no formato UUID WebP gerados em runtime (protege imagens de catálogo fixo e banners).
 * - REGRA 2: Verifica se nenhum outro produto ainda referencia essa mesma URL antes de deletar.
 * - REGRA 3: Não falha e não interrompe operações caso o arquivo não exista no disco.
 */
export async function deleteUploadedFileSafe(fileUrlOrName: string): Promise<boolean> {
  try {
    if (!fileUrlOrName || typeof fileUrlOrName !== "string") return false;
    const fileName = path.basename(fileUrlOrName);

    // Protege imagens do catálogo padrão/seed (ex: pets-hero.webp, prod01_01.webp, etc.)
    if (!UUID_WEBP_REGEX.test(fileName)) {
      return false;
    }

    try {
      const { getDb } = await import("./db");
      const { productImages } = await import("../drizzle/schema");
      const { eq } = await import("drizzle-orm");
      const db = await getDb();
      if (db) {
        const canonicalUrl = fileUrlOrName.startsWith("/") ? fileUrlOrName : `/uploads/${fileName}`;
        const inUse = await db
          .select({ id: productImages.id })
          .from(productImages)
          .where(eq(productImages.url, canonicalUrl))
          .limit(1);
        if (inUse.length > 0) {
          return false;
        }
      }
    } catch {
      // Ignora erro de consulta para não travar
    }

    const activeUploadDir = getUploadDir();
    const primaryPath = path.join(activeUploadDir, fileName);

    await fs.unlink(primaryPath).catch(() => {});

    if (activeUploadDir !== BUNDLED_UPLOAD_DIR) {
      const fallbackPath = path.join(BUNDLED_UPLOAD_DIR, fileName);
      await fs.unlink(fallbackPath).catch(() => {});
    }

    return true;
  } catch (error) {
    console.warn("[Uploads] Falha não-fatal ao remover imagem do disco:", error);
    return false;
  }
}

export function registerUploadRoutes(app: Express) {
  app.use("/uploads", async (req, res, next) => {
    const fileName = path.basename(req.path);
    if (!fileName || fileName !== req.path.slice(1) || !/^[-a-zA-Z0-9_]+\.webp$/.test(fileName)) return res.status(404).end();
    
    const activeUploadDir = getUploadDir();
    const primaryPath = path.join(activeUploadDir, fileName);
    const fallbackPath = path.join(BUNDLED_UPLOAD_DIR, fileName);

    try {
      await fs.access(primaryPath);
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Cache-Control", "public, max-age=86400");
      return res.sendFile(primaryPath);
    } catch {
      // Se não encontrado no diretório ativo e este for customizado, busca no diretório padrão bundled do repositório
      if (activeUploadDir !== BUNDLED_UPLOAD_DIR) {
        try {
          await fs.access(fallbackPath);
          res.setHeader("X-Content-Type-Options", "nosniff");
          res.setHeader("Cache-Control", "public, max-age=86400");
          return res.sendFile(fallbackPath);
        } catch {
          return res.status(404).end();
        }
      }
      return res.status(404).end();
    }
  });

  app.post("/api/admin/uploads", (req: Request, res: Response, next) => {
    getAdminByRequest(req).then((admin) => {
      if (!admin) return res.status(401).json({ message: "Sessão administrativa necessária." });
      upload.array("images", 10)(req, res, async (error) => {
        if (error) return res.status(400).json({ message: error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE" ? "Cada imagem deve ter no máximo 1 MB." : (error as Error).message });
        const files = (req.files as Express.Multer.File[] | undefined) || [];
        if (!files.length || files.some((file) => !isWebp(file.buffer))) return res.status(400).json({ message: "Arquivo inválido: somente WebP real é aceito." });
        const targetDir = getUploadDir();
        await fs.mkdir(targetDir, { recursive: true });
        const saved = [];
        for (const file of files) {
          const fileName = `${crypto.randomUUID()}.webp`;
          await fs.writeFile(path.join(targetDir, fileName), file.buffer, { flag: "wx" });
          saved.push({ url: `/uploads/${fileName}`, name: file.originalname, size: file.size, type: file.mimetype });
        }
        return res.status(201).json({ files: saved });
      });
    }).catch(next);
  });
}
