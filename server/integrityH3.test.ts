import { describe, expect, it, beforeAll, afterEach, afterAll, vi } from "vitest";
import { drizzle } from "drizzle-orm/mysql2";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  users,
  orders,
  orderItems,
  products,
  productVariants,
  shippingRules,
  orderNumberSequence,
} from "../drizzle/schema";
import * as db from "./db";
import { createDatabaseConnection, createOrder, getDb, setDb } from "./db";
import {
  formatOrderDate,
  formatBookingDate,
  getFirstName,
} from "../shared/accountFormatters";
import { handleGoogleAuthCallback } from "./_core/googleAuth";
import {
  GOOGLE_AUTH_STATE_COOKIE,
  GOOGLE_AUTH_VERIFIER_COOKIE,
  GOOGLE_AUTH_NONCE_COOKIE,
} from "./_core/googleAuth";
import type { Request, Response } from "express";

const mockVerifyIdToken = vi.fn();
const mockGetToken = vi.fn().mockResolvedValue({
  tokens: { id_token: "mock-valid-id-token" },
});

vi.mock("google-auth-library", () => ({
  CodeChallengeMethod: { Plain: "plain", S256: "S256" },
  OAuth2Client: class {
    getToken = mockGetToken;
    verifyIdToken = mockVerifyIdToken;
  },
}));

// GUARDA DE SEGURANÇA: Exigência estrita de TEST_DATABASE_URL terminando em "_test"
const testDbUrl = process.env.TEST_DATABASE_URL;
if (!testDbUrl) {
  throw new Error("TEST_DATABASE_URL não configurada no ambiente. Abortando testes.");
}

const urlMatch = testDbUrl.replace(/^mysql:\/\//, "http://");
const dbName = new URL(urlMatch).pathname.replace(/^\//, "");
if (!dbName.endsWith("_test")) {
  throw new Error(
    `TEST_DATABASE_URL DEVE apontar para um banco que termina em '_test'. Banco atual: '${dbName}'. Operação abortada para proteger dados.`
  );
}

// Configura o banco de teste estritamente com TEST_DATABASE_URL
process.env.DATABASE_URL = testDbUrl;
const testDb = createDatabaseConnection(testDbUrl);
setDb(testDb);

describe("Passo H3 - Integridade: Número do Pedido, Fuso Horário e Exibição", () => {
  const createdOrderIds: number[] = [];
  const createdProductIds: number[] = [];
  const createdShippingRuleIds: number[] = [];

  let testProductId: number;
  let testVariantLabel: string;

  beforeAll(async () => {
    // Cria produto e variante para pedidos
    const [prodRes] = await testDb.insert(products).values({
      slug: `prod-h3-${Date.now()}`,
      name: "Ração H3 Teste",
      category: "Cachorros",
      subcategory: "Alimentos",
      status: "active",
    });
    testProductId = Number(prodRes.insertId);
    createdProductIds.push(testProductId);

    testVariantLabel = "Padrão";
    await testDb.insert(productVariants).values({
      productId: testProductId,
      label: testVariantLabel,
      sku: `SKU-H3-${Date.now()}`,
      price: "100.00",
      stock: 500,
    });

    // Cria regra de frete fixa para Aracaju / Centro
    const [shipRes] = await testDb.insert(shippingRules).values({
      ruleType: "local_neighborhoods",
      neighborhoods: "Centro",
      city: "Aracaju",
      fee: "15.00",
      mode: "fixed",
      active: true,
    });
    createdShippingRuleIds.push(Number(shipRes.insertId));
  });

  afterEach(async () => {
    if (createdOrderIds.length > 0) {
      await testDb.delete(orderItems).where(inArray(orderItems.orderId, createdOrderIds));
      await testDb.delete(orders).where(inArray(orders.id, createdOrderIds));
      createdOrderIds.length = 0;
    }
  });

  afterAll(async () => {
    if (createdShippingRuleIds.length > 0) {
      await testDb.delete(shippingRules).where(inArray(shippingRules.id, createdShippingRuleIds));
    }
    if (createdProductIds.length > 0) {
      await testDb.delete(productVariants).where(inArray(productVariants.productId, createdProductIds));
      await testDb.delete(products).where(inArray(products.id, createdProductIds));
    }
  });

  function makeOrderInput() {
    return {
      customerName: "Cliente Teste H3",
      whatsapp: "(79) 99999-9999",
      street: "Rua das Flores",
      number: "123",
      neighborhood: "Centro",
      city: "Aracaju",
      state: "SE",
      paymentMethod: "pix",
      subtotal: "100.00",
      shippingFee: "15.00",
      discount: "0.00",
      total: "115.00",
      items: [
        {
          productId: testProductId,
          productName: "Ração H3 Teste",
          variantLabel: testVariantLabel,
          quantity: 1,
          unitPrice: "100.00",
        },
      ],
    };
  }

  it("a) Contador defasado: nextNumber = 1 e pedidos com 1..3 -> novo pedido recebe 4 e contador passa a 5", async () => {
    // 1. Limpa pedidos anteriores para isolar o teste
    await testDb.delete(orderItems);
    await testDb.delete(orders);

    // 2. Insere 3 pedidos manuais com orderNumber 1, 2, 3
    for (const num of [1, 2, 3]) {
      const [res] = await testDb.insert(orders).values({
        orderNumber: num,
        customerName: `Cliente ${num}`,
        whatsapp: "79999999999",
        street: "Rua",
        number: "1",
        neighborhood: "Centro",
        city: "Aracaju",
        state: "SE",
        paymentMethod: "pix",
        subtotal: "100.00",
        shippingFee: "15.00",
        discount: "0.00",
        total: "115.00",
      });
      createdOrderIds.push(Number(res.insertId));
    }

    // 3. Força order_number_sequence com nextNumber = 1 (defasado)
    await testDb
      .insert(orderNumberSequence)
      .values({ id: 1, nextNumber: 1 })
      .onDuplicateKeyUpdate({ set: { nextNumber: 1 } });

    // 4. Cria pedido via createOrder
    const result = await createOrder(makeOrderInput());
    createdOrderIds.push(result.orderId);

    // O novo pedido deve receber o número 4 (MAX + 1) e não falhar com duplicidade
    expect(result.orderNumber).toBe(4);

    // O contador deve ser atualizado para 5
    const [seq] = await testDb
      .select()
      .from(orderNumberSequence)
      .where(eq(orderNumberSequence.id, 1));
    expect(seq?.nextNumber).toBe(5);
  });

  it("b) Linha do contador ausente: createOrder cria a linha e usa MAX(orderNumber) + 1 (ou 1 se não houver pedidos)", async () => {
    // 1. Apaga a linha da sequência
    await testDb.delete(orderNumberSequence).where(eq(orderNumberSequence.id, 1));

    // 2. Apaga pedidos para testar caso base (sem pedidos)
    await testDb.delete(orderItems);
    await testDb.delete(orders);

    // Cria primeiro pedido: deve receber 1 e criar contador com nextNumber 2
    const firstOrder = await createOrder(makeOrderInput());
    createdOrderIds.push(firstOrder.orderId);
    expect(firstOrder.orderNumber).toBe(1);

    const [seqAfterFirst] = await testDb
      .select()
      .from(orderNumberSequence)
      .where(eq(orderNumberSequence.id, 1));
    expect(seqAfterFirst).toBeDefined();
    expect(seqAfterFirst?.nextNumber).toBe(2);

    // Apaga a linha do contador novamente, mas agora existem pedidos (MAX = 1)
    await testDb.delete(orderNumberSequence).where(eq(orderNumberSequence.id, 1));

    const secondOrder = await createOrder(makeOrderInput());
    createdOrderIds.push(secondOrder.orderId);
    expect(secondOrder.orderNumber).toBe(2);

    const [seqAfterSecond] = await testDb
      .select()
      .from(orderNumberSequence)
      .where(eq(orderNumberSequence.id, 1));
    expect(seqAfterSecond?.nextNumber).toBe(3);
  });

  it("c) Concorrência: 5 createOrder em paralelo (Promise.all) recebem 5 números distintos e consecutivos", async () => {
    const promises = Array.from({ length: 5 }, () => createOrder(makeOrderInput()));
    const results = await Promise.all(promises);

    for (const r of results) {
      createdOrderIds.push(r.orderId);
    }

    const orderNumbers = results.map((r) => r.orderNumber).sort((a, b) => a - b);

    // Devem ser 5 números distintos
    const uniqueNumbers = new Set(orderNumbers);
    expect(uniqueNumbers.size).toBe(5);

    // Devem ser estritamente consecutivos
    for (let i = 1; i < orderNumbers.length; i++) {
      expect(orderNumbers[i]).toBe(orderNumbers[i - 1] + 1);
    }
  });

  it("d) Fuso: um pedido criado agora tem createdAt dentro de 5 segundos de Date.now() quando lido pelo app", async () => {
    const beforeCall = Date.now();
    const result = await createOrder(makeOrderInput());
    createdOrderIds.push(result.orderId);
    const afterCall = Date.now();

    const [savedOrder] = await testDb
      .select()
      .from(orders)
      .where(eq(orders.id, result.orderId));

    expect(savedOrder).toBeDefined();
    const orderCreatedAtMs = new Date(savedOrder.createdAt).getTime();

    // A data salva pelo now() do banco deve estar alinhada com Date.now() do JS (em UTC)
    expect(Math.abs(orderCreatedAtMs - beforeCall)).toBeLessThan(5000);
    expect(Math.abs(orderCreatedAtMs - afterCall)).toBeLessThan(5000);
  });

  it("e) Funções puras (shared/accountFormatters.ts): America/Sao_Paulo em formatOrderDate, AAAA-MM-DD estrito em formatBookingDate e getFirstName com '@'", () => {
    // formatOrderDate usa o fuso America/Sao_Paulo (2026-10-15T02:30:00Z é 14/10/2026 às 23:30 no fuso de SP)
    expect(formatOrderDate("2026-10-15T02:30:00Z")).toBe("14/10/2026");

    // formatBookingDate só aceita AAAA-MM-DD estrito e devolve texto original se vier com hora
    expect(formatBookingDate("2026-10-25")).toBe("25/10/2026");
    expect(formatBookingDate("2026-10-25 14:00")).toBe("2026-10-25 14:00");
    expect(formatBookingDate("2026-10-25T14:00:00Z")).toBe("2026-10-25T14:00:00Z");

    // getFirstName devolve "" quando o nome contém "@"
    expect(getFirstName("cliente@gmail.com")).toBe("");
    expect(getFirstName("joao.silva@empresa.com.br")).toBe("");
    expect(getFirstName("Maria Silva")).toBe("Maria");
    expect(getFirstName("Carlos")).toBe("Carlos");
  });

  it("f) Login Google (testes com mocks): quando o Google não traz name, salva com o nome 'Cliente' e NÃO com o e-mail", async () => {
    mockVerifyIdToken.mockResolvedValueOnce({
      getPayload: () => ({
        sub: "google-sub-noname-123",
        email: "usuario.sem.nome@gmail.com",
        email_verified: true,
        name: undefined,
        nonce: "test-nonce-123",
      }),
    });

    const mockUpsert = vi.spyOn(db, "upsertUser").mockResolvedValue(undefined);

    let redirected = false;
    const req = {
      headers: {
        cookie: `${GOOGLE_AUTH_STATE_COOKIE}=test-state; ${GOOGLE_AUTH_VERIFIER_COOKIE}=test-verifier; ${GOOGLE_AUTH_NONCE_COOKIE}=test-nonce-123`,
      },
      query: {
        code: "test-code",
        state: "test-state",
      },
    } as unknown as Request;

    const res = {
      setHeader: vi.fn(),
      cookie: vi.fn(),
      clearCookie: vi.fn(),
      status: vi.fn().mockReturnThis(),
      send: vi.fn(),
      redirect: vi.fn().mockImplementation(() => {
        redirected = true;
      }),
    } as unknown as Response;

    await handleGoogleAuthCallback(req, res);

    expect(redirected).toBe(true);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        openId: "google:google-sub-noname-123",
        email: "usuario.sem.nome@gmail.com",
        name: "Cliente",
      })
    );
  });
});
