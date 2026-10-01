import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import type { Express, Request, Response } from "express";
import multer from "multer";
import { getAdminByRequest } from "./adminAuth";

export const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");
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

export function registerUploadRoutes(app: Express) {
  app.use("/uploads", async (req, res, next) => {
    const fileName = path.basename(req.path);
    if (!fileName || fileName !== req.path.slice(1) || !/^[-a-zA-Z0-9_]+\.webp$/.test(fileName)) return res.status(404).end();
    try { await fs.access(path.join(UPLOAD_DIR, fileName)); return res.sendFile(path.join(UPLOAD_DIR, fileName)); } catch { return res.status(404).end(); }
  });

  app.post("/api/admin/uploads", (req: Request, res: Response, next) => {
    getAdminByRequest(req).then((admin) => {
      if (!admin) return res.status(401).json({ message: "Sessão administrativa necessária." });
      upload.array("images", 10)(req, res, async (error) => {
        if (error) return res.status(400).json({ message: error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE" ? "Cada imagem deve ter no máximo 1 MB." : (error as Error).message });
        const files = (req.files as Express.Multer.File[] | undefined) || [];
        if (!files.length || files.some((file) => !isWebp(file.buffer))) return res.status(400).json({ message: "Arquivo inválido: somente WebP real é aceito." });
        await fs.mkdir(UPLOAD_DIR, { recursive: true });
        const saved = [];
        for (const file of files) {
          const fileName = `${crypto.randomUUID()}.webp`;
          await fs.writeFile(path.join(UPLOAD_DIR, fileName), file.buffer, { flag: "wx" });
          saved.push({ url: `/uploads/${fileName}`, name: file.originalname, size: file.size, type: file.mimetype });
        }
        return res.status(201).json({ files: saved });
      });
    }).catch(next);
  });
}
