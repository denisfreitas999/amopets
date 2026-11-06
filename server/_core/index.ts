import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerGoogleAuthRoutes } from "./googleAuth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { registerUploadRoutes } from "../uploadRoutes";
import { registerOrderPdfRoutes } from "../orderPdf";
import { registerBookingPdfRoutes } from "../bookingPdf";
import { assertSessionSecret } from "./env";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

const DEV_ORIGIN_REGEX = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  // Security headers middleware
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    if (process.env.NODE_ENV === "production") {
      res.setHeader("Strict-Transport-Security", "max-age=15552000");
    }
    next();
  });

  // Configure body parser with 1 MB size limit
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ limit: "1mb", extended: true }));

  // CORS middleware
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    let isAllowed = false;

    if (origin) {
      if (process.env.NODE_ENV === "development") {
        isAllowed = DEV_ORIGIN_REGEX.test(origin);
      } else if (process.env.NODE_ENV === "production") {
        isAllowed = Boolean(process.env.CORS_ORIGIN && origin === process.env.CORS_ORIGIN);
      }
    }

    if (origin && isAllowed) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    }

    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });

  registerGoogleAuthRoutes(app);
  registerUploadRoutes(app);
  registerOrderPdfRoutes(app);
  registerBookingPdfRoutes(app);

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "amopets", demo: false, timestamp: new Date().toISOString() });
  });

  // O tratador de erros NÃO é montado aqui para poder capturar rotas
  // registradas depois (Vite em dev, serveStatic em prod).
  // Chame installErrorHandler(app) APÓS setupVite/serveStatic.

  return app;
}

/**
 * Monta o tratador de erros centralizado no app.
 * Deve ser chamado DEPOIS de setupVite() ou serveStatic().
 */
export function installErrorHandler(app: ReturnType<typeof createApp>) {
  app.use((error: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (res.headersSent) return next(error);
    const errStatus =
      typeof (error as any)?.status === "number"
        ? (error as any).status
        : typeof (error as any)?.statusCode === "number"
          ? (error as any).statusCode
          : 500;

    if (errStatus === 413) {
      return res.status(413).json({ message: "Payload too large" });
    }

    console.error("[HTTP] Request failed", error instanceof Error ? error.message : "unknown error");
    res.status(errStatus).json({ message: "Ocorreu um erro interno. Tente novamente." });
  });
}

async function startServer() {
  const app = createApp();
  const server = createServer(app);

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Tratador de erros montado DEPOIS do Vite/static para cobrir todas as rotas
  installErrorHandler(app);

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  assertSessionSecret(process.env);

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

if (process.env.NODE_ENV !== "test") {
  startServer().catch(console.error);
}
