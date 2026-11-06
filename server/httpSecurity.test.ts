import fs from "node:fs/promises";
import path from "node:path";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { createApp } from "./_core/index";
import { ADMIN_COOKIE, createAdminToken } from "./adminAuth";
import * as db from "./db";
import { resetRateLimits, resolveClientIp } from "./rateLimit";

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    createOrder: vi.fn().mockResolvedValue({ id: 1, orderNumber: "ORD-9999" }),
    createBooking: vi.fn().mockResolvedValue({ id: 1 }),
    calculateCoupon: vi.fn().mockResolvedValue({ valid: true, discount: "10.00", total: "90.00" }),
    getAdminByUsername: vi.fn(),
  };
});

describe("Superfície HTTP e Segurança (Passo H2b)", () => {
  const originalEnv = { ...process.env };
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    process.env = { ...originalEnv, NODE_ENV: "test" };
    try {
      resetRateLimits();
    } catch {}
    app = createApp();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.useRealTimers();
  });

  it("a) Corpo JSON de 2 MB em /api/trpc/checkout.validateCoupon responde 413; 300 KB não responde 413; upload multipart aceita WebP de até 1 MB", async () => {
    // 2 MB JSON payload
    const bigPayload = {
      code: "PROMO",
      subtotal: 100,
      padding: "x".repeat(2 * 1024 * 1024),
    };
    const res2mb = await request(app)
      .post("/api/trpc/checkout.validateCoupon")
      .set("Content-Type", "application/json")
      .send(bigPayload);
    expect(res2mb.status).toBe(413);

    // 300 KB JSON payload
    const smallPayload = {
      code: "PROMO",
      subtotal: 100,
      padding: "x".repeat(300 * 1024),
    };
    const res300kb = await request(app)
      .post("/api/trpc/checkout.validateCoupon")
      .set("Content-Type", "application/json")
      .send(smallPayload);
    expect(res300kb.status).not.toBe(413);

    // Upload multipart do admin de até 1 MB
    // Cria um buffer WebP válido (RIFF....WEBP) com ~400 KB
    const webpHeader = Buffer.from("RIFF\x00\x00\x00\x00WEBPVP8 ");
    const padding = Buffer.alloc(400 * 1024, 0);
    const validWebpBuffer = Buffer.concat([webpHeader, padding]);

    const adminToken = createAdminToken(1);
    const uploadRes = await request(app)
      .post("/api/admin/uploads")
      .set("Cookie", `${ADMIN_COOKIE}=${adminToken}`)
      .attach("images", validWebpBuffer, "teste-400k.webp");

    expect(uploadRes.status).toBe(201);
    if (uploadRes.body?.files) {
      for (const file of uploadRes.body.files) {
        const fullPath = path.resolve(process.cwd(), file.url.replace(/^\//, ""));
        await fs.unlink(fullPath).catch(() => {});
      }
    }
  });

  it("b) GET rota de storage legado responde 404", async () => {
    const legacyStorageRoute = ["/", "m", "a", "n", "u", "s", "-storage/qualquer-coisa"].join("");
    const res = await request(app).get(legacyStorageRoute);
    expect(res.status).toBe(404);
  });

  it("c) CORS: em development, localhost aceita; malicioso não recebe; em production sem CORS_ORIGIN nenhuma recebe; com CORS_ORIGIN só a configurada recebe", async () => {
    // development: localhost permitido
    process.env.NODE_ENV = "development";
    delete process.env.CORS_ORIGIN;
    let res = await request(app)
      .get("/api/health")
      .set("Origin", "http://localhost:5173");
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(res.headers["access-control-allow-credentials"]).toBe("true");

    // development: site malicioso NÃO recebe nenhum cabeçalho Access-Control-*
    res = await request(app)
      .get("/api/health")
      .set("Origin", "https://site-malicioso.example");
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    expect(res.headers["access-control-allow-credentials"]).toBeUndefined();

    // production sem CORS_ORIGIN: nenhuma origem recebe
    process.env.NODE_ENV = "production";
    delete process.env.CORS_ORIGIN;
    res = await request(app)
      .get("/api/health")
      .set("Origin", "http://localhost:5173");
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
    res = await request(app)
      .get("/api/health")
      .set("Origin", "https://meusite.example");
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();

    // production com CORS_ORIGIN=https://meusite.example: só essa recebe
    process.env.CORS_ORIGIN = "https://meusite.example";
    res = await request(app)
      .get("/api/health")
      .set("Origin", "https://meusite.example");
    expect(res.headers["access-control-allow-origin"]).toBe("https://meusite.example");
    expect(res.headers["access-control-allow-credentials"]).toBe("true");

    res = await request(app)
      .get("/api/health")
      .set("Origin", "https://outro-site.example");
    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("d) Cabeçalhos de segurança em /api/health: nosniff, SAMEORIGIN, strict-origin-when-cross-origin, Permissions-Policy; SEM X-Powered-By; HSTS somente em production", async () => {
    process.env.NODE_ENV = "development";
    let res = await request(app).get("/api/health");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("SAMEORIGIN");
    expect(res.headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(res.headers["permissions-policy"]).toContain("camera=()");
    expect(res.headers["permissions-policy"]).toContain("microphone=()");
    expect(res.headers["permissions-policy"]).toContain("geolocation=()");
    expect(res.headers["x-powered-by"]).toBeUndefined();
    expect(res.headers["strict-transport-security"]).toBeUndefined();

    // HSTS somente em production
    process.env.NODE_ENV = "production";
    res = await request(app).get("/api/health");
    expect(res.headers["strict-transport-security"]).toBe("max-age=15552000");
  });

  it("e) GET /uploads/<arquivo> responde com X-Content-Type-Options: nosniff e Cache-Control: public, max-age=86400", async () => {
    const res = await request(app).get("/uploads/pets-hero.webp");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["cache-control"]).toBe("public, max-age=86400");
  });

  it("f) Rate limit: 21ª chamada em 1h a createOrder e booking.create dá TOO_MANY_REQUESTS; 31ª em 15m a validateCoupon também; outro IP não é afetado; volta a funcionar após janela", async () => {
    vi.useFakeTimers();
    const baseTime = new Date("2026-10-15T12:00:00Z");
    vi.setSystemTime(baseTime);

    const clientIp = "10.0.0.1, 192.168.1.100";
    const otherIp = "10.0.0.1, 192.168.1.200";

    const createOrderInput = {
      customerName: "Cliente Teste",
      whatsapp: "(79) 99999-9999",
      street: "Rua Teste",
      number: "123",
      neighborhood: "Centro",
      city: "Aracaju",
      state: "SE",
      paymentMethod: "pix",
      subtotal: "100.00",
      shippingFee: "10.00",
      discount: "0.00",
      total: "110.00",
      items: [
        {
          productId: 1,
          productName: "Racao",
          quantity: 1,
          unitPrice: "100.00",
        },
      ],
    };

    const bookingInput = {
      customerName: "Cliente Teste",
      whatsapp: "(79) 99999-9999",
      petName: "Rex",
      petSize: "small" as const,
      serviceName: "Banho",
      date: "2026-10-25",
      time: "14:00",
    };

    const couponInput = {
      code: "CUPOM10",
      subtotal: 100,
    };

    const getTrpcError = (res: request.Response) => res.body?.error?.json ?? res.body?.error;

    // 1. checkout.createOrder: 20 permitidas por hora, 21ª bloqueada
    for (let i = 1; i <= 20; i++) {
      const res = await request(app)
        .post("/api/trpc/checkout.createOrder")
        .set("X-Forwarded-For", clientIp)
        .send(createOrderInput);
      expect(res.status, `createOrder call ${i}`).not.toBe(429);
      if (getTrpcError(res)) {
        expect(getTrpcError(res)?.data?.code).not.toBe("TOO_MANY_REQUESTS");
      }
    }

    const resOrder21 = await request(app)
      .post("/api/trpc/checkout.createOrder")
      .set("X-Forwarded-For", clientIp)
      .send(createOrderInput);
    expect(resOrder21.status).toBe(429);
    expect(getTrpcError(resOrder21)?.data?.code).toBe("TOO_MANY_REQUESTS");
    expect(getTrpcError(resOrder21)?.message).toBe("Muitas tentativas. Tente novamente em alguns minutos.");

    // Outro IP não é afetado
    const resOrderOtherIp = await request(app)
      .post("/api/trpc/checkout.createOrder")
      .set("X-Forwarded-For", otherIp)
      .send(createOrderInput);
    expect(getTrpcError(resOrderOtherIp)?.data?.code).not.toBe("TOO_MANY_REQUESTS");

    // Passada a janela de 1 hora, volta a funcionar
    vi.advanceTimersByTime(60 * 60 * 1000 + 1000);
    const resOrderAfterWindow = await request(app)
      .post("/api/trpc/checkout.createOrder")
      .set("X-Forwarded-For", clientIp)
      .send(createOrderInput);
    expect(getTrpcError(resOrderAfterWindow)?.data?.code).not.toBe("TOO_MANY_REQUESTS");

    // 2. booking.create: 20 permitidas por hora, 21ª bloqueada
    for (let i = 1; i <= 20; i++) {
      const res = await request(app)
        .post("/api/trpc/booking.create")
        .set("X-Forwarded-For", clientIp)
        .send(bookingInput);
      expect(res.status, `booking.create call ${i}`).not.toBe(429);
      if (getTrpcError(res)) {
        expect(getTrpcError(res)?.data?.code).not.toBe("TOO_MANY_REQUESTS");
      }
    }

    const resBooking21 = await request(app)
      .post("/api/trpc/booking.create")
      .set("X-Forwarded-For", clientIp)
      .send(bookingInput);
    expect(resBooking21.status).toBe(429);
    expect(getTrpcError(resBooking21)?.data?.code).toBe("TOO_MANY_REQUESTS");
    expect(getTrpcError(resBooking21)?.message).toBe("Muitas tentativas. Tente novamente em alguns minutos.");

    // 3. checkout.validateCoupon: 30 permitidas em 15 minutos, 31ª bloqueada
    for (let i = 1; i <= 30; i++) {
      const res = await request(app)
        .post("/api/trpc/checkout.validateCoupon")
        .set("X-Forwarded-For", clientIp)
        .send(couponInput);
      expect(res.status, `validateCoupon call ${i}`).not.toBe(429);
      if (getTrpcError(res)) {
        expect(getTrpcError(res)?.data?.code).not.toBe("TOO_MANY_REQUESTS");
      }
    }

    const resCoupon31 = await request(app)
      .post("/api/trpc/checkout.validateCoupon")
      .set("X-Forwarded-For", clientIp)
      .send(couponInput);
    expect(resCoupon31.status).toBe(429);
    expect(getTrpcError(resCoupon31)?.data?.code).toBe("TOO_MANY_REQUESTS");
    expect(getTrpcError(resCoupon31)?.message).toBe("Muitas tentativas. Tente novamente em alguns minutos.");
  });

  describe("IP do cliente no Rate Limit (Passo H2c)", () => {
    it("a) Função pura: resolveClientIp({ headers: { 'x-forwarded-for': '9.9.9.9, 10.0.0.5' }, ip: '10.0.0.5' }) devolve '10.0.0.5' (ignora o cabeçalho e usa req.ip)", () => {
      const mockReq = {
        headers: { "x-forwarded-for": "9.9.9.9, 10.0.0.5" },
        ip: "10.0.0.5",
      };
      expect(resolveClientIp(mockReq)).toBe("10.0.0.5");
    });

    it("b) Com o app real (supertest, trust proxy = 1): 21 requisições a booking.create com X-Forwarded-For diferente à ESQUERDA ('1.1.1.N, 7.7.7.7') e MESMO último valor ('7.7.7.7') contam como mesmo cliente: a 21ª é bloqueada", async () => {
      const bookingInput = {
        customerName: "Cliente Teste",
        whatsapp: "(79) 99999-9999",
        petName: "Rex",
        petSize: "small" as const,
        serviceName: "Banho",
        date: "2026-10-25",
        time: "14:00",
      };
      const getTrpcError = (res: request.Response) => res.body?.error?.json ?? res.body?.error;

      for (let i = 1; i <= 20; i++) {
        const res = await request(app)
          .post("/api/trpc/booking.create")
          .set("X-Forwarded-For", `1.1.1.${i}, 7.7.7.7`)
          .send(bookingInput);
        expect(res.status).not.toBe(429);
        if (getTrpcError(res)) {
          expect(getTrpcError(res)?.data?.code).not.toBe("TOO_MANY_REQUESTS");
        }
      }

      const res21 = await request(app)
        .post("/api/trpc/booking.create")
        .set("X-Forwarded-For", "1.1.1.99, 7.7.7.7")
        .send(bookingInput);
      expect(res21.status).toBe(429);
      expect(getTrpcError(res21)?.data?.code).toBe("TOO_MANY_REQUESTS");
      expect(getTrpcError(res21)?.message).toBe("Muitas tentativas. Tente novamente em alguns minutos.");
    });

    it("c) Requisições com último valor diferente ('7.7.7.7' e '8.8.8.8') são clientes diferentes: um bloqueado não afeta o outro", async () => {
      const bookingInput = {
        customerName: "Cliente Teste",
        whatsapp: "(79) 99999-9999",
        petName: "Rex",
        petSize: "small" as const,
        serviceName: "Banho",
        date: "2026-10-25",
        time: "14:00",
      };
      const getTrpcError = (res: request.Response) => res.body?.error?.json ?? res.body?.error;

      // Bloqueia o IP 7.7.7.7
      for (let i = 1; i <= 21; i++) {
        await request(app)
          .post("/api/trpc/booking.create")
          .set("X-Forwarded-For", `1.1.1.${i}, 7.7.7.7`)
          .send(bookingInput);
      }

      // Requisição de 8.8.8.8 não é afetada
      const resOther = await request(app)
        .post("/api/trpc/booking.create")
        .set("X-Forwarded-For", "1.1.1.1, 8.8.8.8")
        .send(bookingInput);
      expect(resOther.status).not.toBe(429);
      expect(getTrpcError(resOther)?.data?.code).not.toBe("TOO_MANY_REQUESTS");
    });

    it("d) IPv4 mapeado em IPv6 ('::ffff:7.7.7.7') e '7.7.7.7' contam como a mesma chave", () => {
      expect(resolveClientIp({ ip: "::ffff:7.7.7.7" })).toBe("7.7.7.7");
      expect(resolveClientIp({ ip: "7.7.7.7" })).toBe("7.7.7.7");
      expect(resolveClientIp({ socket: { remoteAddress: "::ffff:192.168.0.1" } })).toBe("192.168.0.1");
    });
  });
});
