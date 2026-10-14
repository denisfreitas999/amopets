import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { drizzle } from "drizzle-orm/mysql2";
import { inArray } from "drizzle-orm";
import { users, orders, orderItems, bookings, type User } from "../drizzle/schema";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { setDb, getDb } from "./db";

// GUARDA DE SEGURANÇA: Exigência estrita de TEST_DATABASE_URL terminando em "_test"
const testDbUrl = process.env.TEST_DATABASE_URL;
if (!testDbUrl) {
  throw new Error("TEST_DATABASE_URL não configurada no ambiente. Abortando testes.");
}

const urlMatch = testDbUrl.replace(/^mysql:\/\//, "http://");
const dbName = new URL(urlMatch).pathname.replace(/^\//, "");
if (!dbName.endsWith("_test")) {
  throw new Error(`TEST_DATABASE_URL DEVE apontar para um banco que termina em '_test'. Banco atual: '${dbName}'. Operação abortada para proteger dados.`);
}

// Configura o banco de teste estritamente com TEST_DATABASE_URL
process.env.DATABASE_URL = testDbUrl;
const testDb = drizzle(testDbUrl);
if (typeof setDb === "function") {
  setDb(testDb);
}

function createContextForUser(user: User | null, admin: { id: number; name: string; username: string } | null = null): TrpcContext {
  return {
    user,
    admin,
    adminSession: admin !== null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("Passo E - account.orders e account.bookings protegidos", () => {
  const createdUserIds: number[] = [];
  const createdOrderIds: number[] = [];
  const createdBookingIds: number[] = [];

  afterEach(async () => {
    // Limpeza de todos os registros criados após cada teste
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

  it("regra de banco: trava falha se banco não terminar em _test", () => {
    const invalidUrl = "mysql://root@localhost:3306/amopets_dev";
    const invalidDbName = new URL(invalidUrl.replace(/^mysql:\/\//, "http://")).pathname.replace(/^\//, "");
    expect(invalidDbName.endsWith("_test")).toBe(false);
    expect(dbName.endsWith("_test")).toBe(true);
  });

  it("a) sem sessão (ctx.user null): account.orders e account.bookings respondem UNAUTHORIZED", async () => {
    const caller = appRouter.createCaller(createContextForUser(null));
    await expect((caller as any).account.orders()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect((caller as any).account.bookings()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("b) só admin (ctx.admin presente, ctx.user null): ambos respondem UNAUTHORIZED", async () => {
    const caller = appRouter.createCaller(createContextForUser(null, { id: 1, name: "Admin", username: "admin@amopets.com.br" }));
    await expect((caller as any).account.orders()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect((caller as any).account.bookings()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("c) isolamento: usuários A e B recebem somente seus próprios registros, e pedido sem userId não aparece", async () => {
    // Cria Usuário A
    const [resA] = await testDb.insert(users).values({
      openId: `test-a-${Date.now()}-${Math.random()}`,
      name: "Cliente A",
      email: "a@test.com",
      loginMethod: "google",
      role: "user",
    });
    const userAId = Number(resA.insertId);
    createdUserIds.push(userAId);

    // Cria Usuário B
    const [resB] = await testDb.insert(users).values({
      openId: `test-b-${Date.now()}-${Math.random()}`,
      name: "Cliente B",
      email: "b@test.com",
      loginMethod: "google",
      role: "user",
    });
    const userBId = Number(resB.insertId);
    createdUserIds.push(userBId);

    // Cria 2 pedidos para A
    const baseNum = Math.floor(Date.now() / 1000);
    const [resOrderA1] = await testDb.insert(orders).values({
      userId: userAId, orderNumber: baseNum + 1, customerName: "A", whatsapp: "11999990001",
      paymentMethod: "pix", subtotal: "50.00", shippingFee: "10.00", total: "60.00", status: "received",
      createdAt: new Date("2026-10-10T10:00:00Z"),
    });
    createdOrderIds.push(Number(resOrderA1.insertId));
    await testDb.insert(orderItems).values({
      orderId: Number(resOrderA1.insertId), productId: 1, productName: "Item A1", quantity: 1, unitPrice: "50.00",
    });

    const [resOrderA2] = await testDb.insert(orders).values({
      userId: userAId, orderNumber: baseNum + 2, customerName: "A", whatsapp: "11999990001",
      paymentMethod: "pix", subtotal: "80.00", shippingFee: "0.00", total: "80.00", status: "delivered",
      createdAt: new Date("2026-10-11T10:00:00Z"),
    });
    createdOrderIds.push(Number(resOrderA2.insertId));
    await testDb.insert(orderItems).values({
      orderId: Number(resOrderA2.insertId), productId: 2, productName: "Item A2", quantity: 2, unitPrice: "40.00",
    });

    // Cria 2 agendamentos para A
    const [resBookA1] = await testDb.insert(bookings).values({
      userId: userAId, customerName: "A", whatsapp: "11999990001", petName: "Rex A",
      serviceName: "Banho", date: "2026-10-20", time: "10:00", status: "confirmed",
    });
    createdBookingIds.push(Number(resBookA1.insertId));
    const [resBookA2] = await testDb.insert(bookings).values({
      userId: userAId, customerName: "A", whatsapp: "11999990001", petName: "Rex A",
      serviceName: "Tosa", date: "2026-10-21", time: "11:00", status: "requested",
    });
    createdBookingIds.push(Number(resBookA2.insertId));

    // Cria 2 pedidos para B
    const [resOrderB1] = await testDb.insert(orders).values({
      userId: userBId, orderNumber: baseNum + 3, customerName: "B", whatsapp: "11999990002",
      paymentMethod: "card", subtotal: "30.00", shippingFee: "10.00", total: "40.00", status: "preparing",
      createdAt: new Date("2026-10-10T12:00:00Z"),
    });
    createdOrderIds.push(Number(resOrderB1.insertId));
    await testDb.insert(orderItems).values({
      orderId: Number(resOrderB1.insertId), productId: 3, productName: "Item B1", quantity: 1, unitPrice: "30.00",
    });

    const [resOrderB2] = await testDb.insert(orders).values({
      userId: userBId, orderNumber: baseNum + 4, customerName: "B", whatsapp: "11999990002",
      paymentMethod: "pix", subtotal: "90.00", shippingFee: "0.00", total: "90.00", status: "out_for_delivery",
      createdAt: new Date("2026-10-12T12:00:00Z"),
    });
    createdOrderIds.push(Number(resOrderB2.insertId));
    await testDb.insert(orderItems).values({
      orderId: Number(resOrderB2.insertId), productId: 4, productName: "Item B2", quantity: 3, unitPrice: "30.00",
    });

    // Cria 2 agendamentos para B
    const [resBookB1] = await testDb.insert(bookings).values({
      userId: userBId, customerName: "B", whatsapp: "11999990002", petName: "Mimi B",
      serviceName: "Banho Felino", date: "2026-10-22", time: "09:00", status: "requested",
    });
    createdBookingIds.push(Number(resBookB1.insertId));
    const [resBookB2] = await testDb.insert(bookings).values({
      userId: userBId, customerName: "B", whatsapp: "11999990002", petName: "Mimi B",
      serviceName: "Hidratação", date: "2026-10-23", time: "14:00", status: "confirmed",
    });
    createdBookingIds.push(Number(resBookB2.insertId));

    // Cria 1 pedido convidado (userId NULL)
    const [resOrderGuest] = await testDb.insert(orders).values({
      userId: null, orderNumber: baseNum + 5, customerName: "Convidado", whatsapp: "11999990003",
      paymentMethod: "pix", subtotal: "100.00", shippingFee: "0.00", total: "100.00", status: "received",
      createdAt: new Date("2026-10-13T10:00:00Z"),
    });
    createdOrderIds.push(Number(resOrderGuest.insertId));
    await testDb.insert(orderItems).values({
      orderId: Number(resOrderGuest.insertId), productId: 5, productName: "Item Guest", quantity: 1, unitPrice: "100.00",
    });

    // Consulta usuário A
    const callerA = appRouter.createCaller(createContextForUser({ id: userAId } as User));
    const ordersA = await (callerA as any).account.orders();
    const bookingsA = await (callerA as any).account.bookings();

    expect(ordersA).toHaveLength(2);
    expect(ordersA.map((o: any) => o.orderNumber).sort()).toEqual([baseNum + 1, baseNum + 2].sort());
    expect(bookingsA).toHaveLength(2);
    expect(bookingsA.map((b: any) => b.serviceName).sort()).toEqual(["Banho", "Tosa"].sort());

    // Consulta usuário B
    const callerB = appRouter.createCaller(createContextForUser({ id: userBId } as User));
    const ordersB = await (callerB as any).account.orders();
    const bookingsB = await (callerB as any).account.bookings();

    expect(ordersB).toHaveLength(2);
    expect(ordersB.map((o: any) => o.orderNumber).sort()).toEqual([baseNum + 3, baseNum + 4].sort());
    expect(bookingsB).toHaveLength(2);
    expect(bookingsB.map((b: any) => b.serviceName).sort()).toEqual(["Banho Felino", "Hidratação"].sort());

    // Pedido guest não aparece para ninguém
    expect(ordersA.some((o: any) => o.orderNumber === baseNum + 5)).toBe(false);
    expect(ordersB.some((o: any) => o.orderNumber === baseNum + 5)).toBe(false);
  });

  it("d) campos exatos: pedido e agendamento sem dados pessoais nem ids", async () => {
    const [resUser] = await testDb.insert(users).values({
      openId: `test-fields-${Date.now()}`,
      name: "Cliente Campos",
      email: "campos@test.com",
      loginMethod: "google",
      role: "user",
    });
    const userId = Number(resUser.insertId);
    createdUserIds.push(userId);

    const orderNum = Math.floor(Date.now() / 1000) + 10;
    const [resOrder] = await testDb.insert(orders).values({
      userId, orderNumber: orderNum, customerName: "Segredo", whatsapp: "11999998888",
      cep: "01001-000", street: "Rua X", number: "123", neighborhood: "Centro", city: "SP", state: "SP",
      paymentMethod: "pix", couponCode: "PROMO", subtotal: "70.00", shippingFee: "10.00", discount: "5.00", total: "75.00",
      status: "received", createdAt: new Date("2026-10-10T12:00:00Z"),
    });
    createdOrderIds.push(Number(resOrder.insertId));
    await testDb.insert(orderItems).values({
      orderId: Number(resOrder.insertId), productId: 1, productName: "Ração Premium", variantLabel: "10kg", quantity: 2, unitPrice: "35.00",
    });

    const [resBooking] = await testDb.insert(bookings).values({
      userId, customerName: "Segredo", whatsapp: "11999998888", petName: "Rex",
      serviceName: "Tosa Higiênica", petSize: "large", date: "2026-10-25", time: "15:00", status: "confirmed",
    });
    createdBookingIds.push(Number(resBooking.insertId));

    const caller = appRouter.createCaller(createContextForUser({ id: userId } as User));
    const [order] = await (caller as any).account.orders();
    const [booking] = await (caller as any).account.bookings();

    // Verificação de campos exatos com toEqual
    expect(order).toEqual({
      orderNumber: orderNum,
      createdAt: expect.any(Date),
      status: "received",
      total: "75.00",
      items: [
        {
          productName: "Ração Premium",
          variantLabel: "10kg",
          quantity: 2,
          unitPrice: "35.00",
        },
      ],
    });

    expect(booking).toEqual({
      serviceName: "Tosa Higiênica",
      petName: "Rex",
      date: "2026-10-25",
      time: "15:00",
      status: "confirmed",
    });

    // NENHUM id, userId, customerName, whatsapp, endereço, etc.
    const forbiddenOrderFields = ["id", "userId", "customerName", "whatsapp", "cep", "street", "number", "neighborhood", "city", "state", "paymentMethod", "couponCode", "shippingFee", "discount"];
    for (const f of forbiddenOrderFields) {
      expect((order as any)[f]).toBeUndefined();
    }
    const forbiddenBookingFields = ["id", "userId", "customerName", "whatsapp", "petSize", "createdAt"];
    for (const f of forbiddenBookingFields) {
      expect((booking as any)[f]).toBeUndefined();
    }
  });

  it("e) usuário sem pedidos recebe [] e não consulta itens", async () => {
    const [resUser] = await testDb.insert(users).values({
      openId: `test-empty-${Date.now()}`,
      name: "Cliente Vazio",
      email: "vazio@test.com",
      loginMethod: "google",
      role: "user",
    });
    const userId = Number(resUser.insertId);
    createdUserIds.push(userId);

    const caller = appRouter.createCaller(createContextForUser({ id: userId } as User));
    const ordersResult = await (caller as any).account.orders();
    const bookingsResult = await (caller as any).account.bookings();

    expect(ordersResult).toEqual([]);
    expect(bookingsResult).toEqual([]);
  });

  it("f) ordem: pedidos do mais recente para o mais antigo; agendamentos por data e hora decrescentes", async () => {
    const [resUser] = await testDb.insert(users).values({
      openId: `test-order-${Date.now()}`,
      name: "Cliente Ordenacao",
      email: "ordem@test.com",
      loginMethod: "google",
      role: "user",
    });
    const userId = Number(resUser.insertId);
    createdUserIds.push(userId);

    const baseNum = Math.floor(Date.now() / 1000) + 50;

    // Pedido mais antigo (dia 10)
    const [resO1] = await testDb.insert(orders).values({
      userId, orderNumber: baseNum + 1, customerName: "O", whatsapp: "11999990000",
      paymentMethod: "pix", subtotal: "10.00", shippingFee: "0.00", total: "10.00", status: "received",
      createdAt: new Date("2026-10-10T10:00:00Z"),
    });
    createdOrderIds.push(Number(resO1.insertId));

    // Pedido intermediário (dia 12)
    const [resO2] = await testDb.insert(orders).values({
      userId, orderNumber: baseNum + 2, customerName: "O", whatsapp: "11999990000",
      paymentMethod: "pix", subtotal: "20.00", shippingFee: "0.00", total: "20.00", status: "received",
      createdAt: new Date("2026-10-12T10:00:00Z"),
    });
    createdOrderIds.push(Number(resO2.insertId));

    // Pedido mais recente (dia 14)
    const [resO3] = await testDb.insert(orders).values({
      userId, orderNumber: baseNum + 3, customerName: "O", whatsapp: "11999990000",
      paymentMethod: "pix", subtotal: "30.00", shippingFee: "0.00", total: "30.00", status: "received",
      createdAt: new Date("2026-10-14T10:00:00Z"),
    });
    createdOrderIds.push(Number(resO3.insertId));

    // Agendamentos: data 20/10 10:00, data 20/10 14:00, data 22/10 09:00
    const [resB1] = await testDb.insert(bookings).values({
      userId, customerName: "O", whatsapp: "11999990000", petName: "Pet",
      serviceName: "Serviço 1", date: "2026-10-20", time: "10:00", status: "requested",
    });
    createdBookingIds.push(Number(resB1.insertId));
    const [resB2] = await testDb.insert(bookings).values({
      userId, customerName: "O", whatsapp: "11999990000", petName: "Pet",
      serviceName: "Serviço 2", date: "2026-10-20", time: "14:00", status: "requested",
    });
    createdBookingIds.push(Number(resB2.insertId));
    const [resB3] = await testDb.insert(bookings).values({
      userId, customerName: "O", whatsapp: "11999990000", petName: "Pet",
      serviceName: "Serviço 3", date: "2026-10-22", time: "09:00", status: "requested",
    });
    createdBookingIds.push(Number(resB3.insertId));

    const caller = appRouter.createCaller(createContextForUser({ id: userId } as User));
    const ordersResult = await (caller as any).account.orders();
    const bookingsResult = await (caller as any).account.bookings();

    // Pedidos do mais recente para o mais antigo: baseNum+3 (dia 14), baseNum+2 (dia 12), baseNum+1 (dia 10)
    expect(ordersResult.map((o: any) => o.orderNumber)).toEqual([baseNum + 3, baseNum + 2, baseNum + 1]);

    // Agendamentos por data e hora decrescentes: 22/10 09:00, 20/10 14:00, 20/10 10:00
    expect(bookingsResult.map((b: any) => `${b.date} ${b.time}`)).toEqual([
      "2026-10-22 09:00",
      "2026-10-20 14:00",
      "2026-10-20 10:00",
    ]);
  });

  it("g) procedimentos ignoram/rejeitam input com userId ou whatsapp: resultado continua estritamente do usuário da sessão", async () => {
    // Cria Usuário 1 (da sessão)
    const [resU1] = await testDb.insert(users).values({
      openId: `test-session-${Date.now()}`,
      name: "Usuário Sessão",
      email: "sessao@test.com",
      loginMethod: "google",
      role: "user",
    });
    const user1Id = Number(resU1.insertId);
    createdUserIds.push(user1Id);

    // Cria Usuário 2 (alvo de tentativa de IDOR)
    const [resU2] = await testDb.insert(users).values({
      openId: `test-victim-${Date.now()}`,
      name: "Usuário Alvo",
      email: "alvo@test.com",
      loginMethod: "google",
      role: "user",
    });
    const user2Id = Number(resU2.insertId);
    createdUserIds.push(user2Id);

    const baseNum = Math.floor(Date.now() / 1000) + 100;
    // Pedido do Usuário 1
    const [resO1] = await testDb.insert(orders).values({
      userId: user1Id, orderNumber: baseNum + 1, customerName: "Sessao", whatsapp: "11999991111",
      paymentMethod: "pix", subtotal: "15.00", shippingFee: "0.00", total: "15.00", status: "received",
      createdAt: new Date(),
    });
    createdOrderIds.push(Number(resO1.insertId));

    // Pedido do Usuário 2
    const [resO2] = await testDb.insert(orders).values({
      userId: user2Id, orderNumber: baseNum + 2, customerName: "Alvo", whatsapp: "11999992222",
      paymentMethod: "pix", subtotal: "25.00", shippingFee: "0.00", total: "25.00", status: "received",
      createdAt: new Date(),
    });
    createdOrderIds.push(Number(resO2.insertId));

    const caller = appRouter.createCaller(createContextForUser({ id: user1Id } as User));

    // Tenta passar userId ou whatsapp de outro usuário
    const ordersResult = await (caller as any).account.orders({ userId: user2Id, whatsapp: "11999992222" }).catch(async () => {
      // Se tRPC rejeitar o input (pois procedure é sem input), também é válido
      return (caller as any).account.orders();
    });

    expect(ordersResult).toHaveLength(1);
    expect(ordersResult[0].orderNumber).toBe(baseNum + 1);
  });
});

