import { describe, expect, it, beforeAll, afterEach, afterAll } from "vitest";
import { drizzle } from "drizzle-orm/mysql2";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
  users,
  orders,
  orderItems,
  bookings,
  products,
  productVariants,
  shippingRules,
  groomingServices,
  availableSlots,
  orderNumberSequence,
  type User,
} from "../drizzle/schema";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { setDb } from "./db";

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
const testDb = drizzle(testDbUrl);
setDb(testDb);

function createContextForUser(
  user: User | null,
  admin: { id: number; name: string; username: string } | null = null
): TrpcContext {
  return {
    user,
    admin,
    adminSession: admin !== null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("Passo G - Checkout e Agendamento gravam o dono (orders e bookings)", () => {
  const createdUserIds: number[] = [];
  const createdOrderIds: number[] = [];
  const createdBookingIds: number[] = [];
  const createdProductIds: number[] = [];
  const createdShippingRuleIds: number[] = [];
  const createdServiceIds: number[] = [];
  const createdSlotIds: number[] = [];

  let testProductId: number;
  let testVariantLabel: string;
  let testServiceName: string;
  const testBookingDate = "2026-10-27"; // Terça-feira (weekday = 2)
  const testBookingTime = "10:00";

  beforeAll(async () => {
    // Garante linha na sequência de pedidos
    await testDb
      .insert(orderNumberSequence)
      .values({ id: 1, nextNumber: 1000 })
      .onDuplicateKeyUpdate({ set: { nextNumber: sql`${orderNumberSequence.nextNumber}` } });

    // Cria produto e variante de teste
    const [prodRes] = await testDb.insert(products).values({
      slug: `prod-test-${Date.now()}`,
      name: "Ração Teste G",
      category: "Cachorros",
      subcategory: "Alimentos",
      status: "active",
    });
    testProductId = Number(prodRes.insertId);
    createdProductIds.push(testProductId);

    testVariantLabel = "1kg";
    await testDb.insert(productVariants).values({
      productId: testProductId,
      label: testVariantLabel,
      sku: `SKU-${Date.now()}`,
      price: "50.00",
      stock: 100,
    });

    // Cria regra de frete fixa
    const [shipRes] = await testDb.insert(shippingRules).values({
      ruleType: "local_neighborhoods",
      neighborhoods: "Bairro Teste",
      city: "Aracaju",
      fee: "10.00",
      mode: "fixed",
      active: true,
    });
    createdShippingRuleIds.push(Number(shipRes.insertId));

    // Cria serviço de banho e slot
    testServiceName = `Banho Teste G ${Date.now()}`;
    const [servRes] = await testDb.insert(groomingServices).values({
      name: testServiceName,
      priceSmall: "40.00",
      priceMedium: "50.00",
      priceLarge: "60.00",
      active: true,
      sortOrder: 1,
    });
    createdServiceIds.push(Number(servRes.insertId));

    // Limpa slot conflitante se existir
    await testDb
      .delete(availableSlots)
      .where(and(eq(availableSlots.weekday, 2), eq(availableSlots.time, testBookingTime)));

    // 2026-10-27 é terça-feira (getUTCDay() = 2)
    const [slotRes] = await testDb.insert(availableSlots).values({
      weekday: 2,
      time: testBookingTime,
      active: true,
    });
    createdSlotIds.push(Number(slotRes.insertId));
  });

  afterEach(async () => {
    if (createdOrderIds.length > 0) {
      await testDb.delete(orderItems).where(inArray(orderItems.orderId, createdOrderIds));
      await testDb.delete(orders).where(inArray(orders.id, createdOrderIds));
      createdOrderIds.length = 0;
    }
    if (createdBookingIds.length > 0) {
      await testDb.delete(bookings).where(inArray(bookings.id, createdBookingIds));
      createdBookingIds.length = 0;
    }
    if (createdUserIds.length > 0) {
      await testDb.delete(users).where(inArray(users.id, createdUserIds));
      createdUserIds.length = 0;
    }
  });

  afterAll(async () => {
    if (createdSlotIds.length > 0) {
      await testDb.delete(availableSlots).where(inArray(availableSlots.id, createdSlotIds));
    }
    if (createdServiceIds.length > 0) {
      await testDb.delete(groomingServices).where(inArray(groomingServices.id, createdServiceIds));
    }
    if (createdShippingRuleIds.length > 0) {
      await testDb.delete(shippingRules).where(inArray(shippingRules.id, createdShippingRuleIds));
    }
    if (createdProductIds.length > 0) {
      await testDb.delete(productVariants).where(inArray(productVariants.productId, createdProductIds));
      await testDb.delete(products).where(inArray(products.id, createdProductIds));
    }
  });

  // Auxiliar para criar usuário no banco de teste
  async function createTestUser(emailPrefix: string): Promise<User> {
    const [res] = await testDb.insert(users).values({
      openId: `test-g-${emailPrefix}-${Date.now()}-${Math.random()}`,
      name: `Cliente ${emailPrefix}`,
      email: `${emailPrefix}@test.com`,
      loginMethod: "google",
      role: "user",
    });
    const id = Number(res.insertId);
    createdUserIds.push(id);
    const [user] = await testDb.select().from(users).where(eq(users.id, id));
    return user;
  }

  it("a) cliente logado cria pedido: orders.userId = id do usuário da sessão", async () => {
    const user = await createTestUser("clienteA");
    const caller = appRouter.createCaller(createContextForUser(user));

    const result = await caller.checkout.createOrder({
      customerName: "Cliente A",
      whatsapp: "11999990001",
      street: "Rua 1",
      number: "10",
      neighborhood: "Bairro Teste",
      city: "Aracaju",
      state: "SE",
      paymentMethod: "Pix",
      subtotal: "50.00",
      shippingFee: "10.00",
      discount: "0.00",
      total: "60.00",
      items: [
        {
          productId: testProductId,
          productName: "Ração Teste G",
          variantLabel: testVariantLabel,
          quantity: 1,
          unitPrice: "50.00",
        },
      ],
    });

    createdOrderIds.push(result.orderId);

    const [savedOrder] = await testDb.select().from(orders).where(eq(orders.id, result.orderId));
    expect(savedOrder).toBeDefined();
    expect(savedOrder.userId).toBe(user.id);
  });

  it("b) convidado cria pedido: userId NULL", async () => {
    const caller = appRouter.createCaller(createContextForUser(null));

    const result = await caller.checkout.createOrder({
      customerName: "Convidado",
      whatsapp: "11999990002",
      street: "Rua 2",
      number: "20",
      neighborhood: "Bairro Teste",
      city: "Aracaju",
      state: "SE",
      paymentMethod: "Pix",
      subtotal: "50.00",
      shippingFee: "10.00",
      discount: "0.00",
      total: "60.00",
      items: [
        {
          productId: testProductId,
          productName: "Ração Teste G",
          variantLabel: testVariantLabel,
          quantity: 1,
          unitPrice: "50.00",
        },
      ],
    });

    createdOrderIds.push(result.orderId);

    const [savedOrder] = await testDb.select().from(orders).where(eq(orders.id, result.orderId));
    expect(savedOrder).toBeDefined();
    expect(savedOrder.userId).toBeNull();
  });

  it("c) só admin logado (ctx.admin, sem ctx.user) cria pedido: userId NULL", async () => {
    const caller = appRouter.createCaller(
      createContextForUser(null, { id: 1, name: "Admin", username: "admin@amopets.com.br" })
    );

    const result = await caller.checkout.createOrder({
      customerName: "Admin Comprador",
      whatsapp: "11999990003",
      street: "Rua 3",
      number: "30",
      neighborhood: "Bairro Teste",
      city: "Aracaju",
      state: "SE",
      paymentMethod: "Pix",
      subtotal: "50.00",
      shippingFee: "10.00",
      discount: "0.00",
      total: "60.00",
      items: [
        {
          productId: testProductId,
          productName: "Ração Teste G",
          variantLabel: testVariantLabel,
          quantity: 1,
          unitPrice: "50.00",
        },
      ],
    });

    createdOrderIds.push(result.orderId);

    const [savedOrder] = await testDb.select().from(orders).where(eq(orders.id, result.orderId));
    expect(savedOrder).toBeDefined();
    expect(savedOrder.userId).toBeNull();
  });

  it("d) um userId enviado no input é rejeitado ou ignorado e não altera o dono", async () => {
    const userA = await createTestUser("clienteD_A");
    const userVictim = await createTestUser("victimD");
    const caller = appRouter.createCaller(createContextForUser(userA));

    // Passa userId no input para tentar forjar
    const result = await (caller.checkout.createOrder as any)({
      userId: userVictim.id,
      customerName: "Tentativa Spoofing",
      whatsapp: "11999990004",
      street: "Rua 4",
      number: "40",
      neighborhood: "Bairro Teste",
      city: "Aracaju",
      state: "SE",
      paymentMethod: "Pix",
      subtotal: "50.00",
      shippingFee: "10.00",
      discount: "0.00",
      total: "60.00",
      items: [
        {
          productId: testProductId,
          productName: "Ração Teste G",
          variantLabel: testVariantLabel,
          quantity: 1,
          unitPrice: "50.00",
        },
      ],
    });

    createdOrderIds.push(result.orderId);

    const [savedOrder] = await testDb.select().from(orders).where(eq(orders.id, result.orderId));
    expect(savedOrder).toBeDefined();
    // Permanece do usuário autenticado (userA), e NUNCA de userVictim
    expect(savedOrder.userId).toBe(userA.id);
  });

  it("e) o pedido do cliente A aparece em account.orders de A e não no de B", async () => {
    const userA = await createTestUser("clienteE_A");
    const userB = await createTestUser("clienteE_B");

    const callerA = appRouter.createCaller(createContextForUser(userA));
    const callerB = appRouter.createCaller(createContextForUser(userB));

    const orderRes = await callerA.checkout.createOrder({
      customerName: "Cliente A Isolado",
      whatsapp: "11999990005",
      street: "Rua 5",
      number: "50",
      neighborhood: "Bairro Teste",
      city: "Aracaju",
      state: "SE",
      paymentMethod: "Pix",
      subtotal: "50.00",
      shippingFee: "10.00",
      discount: "0.00",
      total: "60.00",
      items: [
        {
          productId: testProductId,
          productName: "Ração Teste G",
          variantLabel: testVariantLabel,
          quantity: 1,
          unitPrice: "50.00",
        },
      ],
    });
    createdOrderIds.push(orderRes.orderId);

    const ordersA = await callerA.account.orders();
    const ordersB = await callerB.account.orders();

    expect(ordersA.some((o) => o.orderNumber === orderRes.orderNumber)).toBe(true);
    expect(ordersB.some((o) => o.orderNumber === orderRes.orderNumber)).toBe(false);
  });

  it("f) agendamento (booking.create e account.bookings): segue os mesmos casos (a) a (e)", async () => {
    // f.a) Cliente logado cria agendamento: bookings.userId = id do usuário da sessão
    const userA = await createTestUser("bookA");
    const callerA = appRouter.createCaller(createContextForUser(userA));

    const bookingIdA = await callerA.booking.create({
      customerName: "Cliente A",
      whatsapp: "11999990011",
      petName: "Rex A",
      petSize: "medium",
      serviceName: testServiceName,
      date: testBookingDate,
      time: testBookingTime,
    });
    createdBookingIds.push(bookingIdA);

    const [savedBookingA] = await testDb.select().from(bookings).where(eq(bookings.id, bookingIdA));
    expect(savedBookingA).toBeDefined();
    expect(savedBookingA.userId).toBe(userA.id);

    // f.b) Convidado cria agendamento: userId NULL
    const callerGuest = appRouter.createCaller(createContextForUser(null));
    const bookingIdGuest = await callerGuest.booking.create({
      customerName: "Convidado Booking",
      whatsapp: "11999990012",
      petName: "Rex Convidado",
      petSize: "medium",
      serviceName: testServiceName,
      date: testBookingDate,
      time: testBookingTime,
    });
    createdBookingIds.push(bookingIdGuest);

    const [savedBookingGuest] = await testDb
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingIdGuest));
    expect(savedBookingGuest).toBeDefined();
    expect(savedBookingGuest.userId).toBeNull();

    // f.c) Só admin cria agendamento: userId NULL
    const callerAdmin = appRouter.createCaller(
      createContextForUser(null, { id: 1, name: "Admin", username: "admin@amopets.com.br" })
    );
    const bookingIdAdmin = await callerAdmin.booking.create({
      customerName: "Admin Booking",
      whatsapp: "11999990013",
      petName: "Rex Admin",
      petSize: "medium",
      serviceName: testServiceName,
      date: testBookingDate,
      time: testBookingTime,
    });
    createdBookingIds.push(bookingIdAdmin);

    const [savedBookingAdmin] = await testDb
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingIdAdmin));
    expect(savedBookingAdmin).toBeDefined();
    expect(savedBookingAdmin.userId).toBeNull();

    // f.d) userId enviado no input é ignorado
    const userVictim = await createTestUser("bookVictim");
    const bookingIdSpoofed = await (callerA.booking.create as any)({
      userId: userVictim.id,
      customerName: "Cliente A Spoof",
      whatsapp: "11999990014",
      petName: "Rex Spoof",
      petSize: "medium",
      serviceName: testServiceName,
      date: testBookingDate,
      time: testBookingTime,
    });
    createdBookingIds.push(bookingIdSpoofed);

    const [savedBookingSpoofed] = await testDb
      .select()
      .from(bookings)
      .where(eq(bookings.id, bookingIdSpoofed));
    expect(savedBookingSpoofed).toBeDefined();
    expect(savedBookingSpoofed.userId).toBe(userA.id);

    // f.e) Isolamento: agendamento de A aparece em account.bookings de A e não de B
    const userB = await createTestUser("bookB");
    const callerB = appRouter.createCaller(createContextForUser(userB));

    const bookingsA = await callerA.account.bookings();
    const bookingsB = await callerB.account.bookings();

    expect(bookingsA.some((b) => b.serviceName === testServiceName && b.petName === "Rex A")).toBe(true);
    expect(bookingsB.some((b) => b.serviceName === testServiceName && b.petName === "Rex A")).toBe(false);
  });
});
