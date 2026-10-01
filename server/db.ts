import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, like, lt, lte, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, adminUsers, availableSlots, bookings, coupons, groomingServices, orderItems, orderNumberSequence, orders, productImages, productSpecs, productVariants, products, shippingRules, users } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { normalizeWhatsapp } from "../shared/phone";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try { _db = drizzle(process.env.DATABASE_URL); }
    catch (error) { console.warn("[Database] Failed to connect:", error); _db = null; }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  textFields.forEach((field) => { if (user[field] !== undefined) { values[field] = user[field] ?? null; updateSet[field] = user[field] ?? null; } });
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function listActiveProducts(filters?: { category?: string; search?: string }) {
  const db = await getDb();
  if (!db) return [];
  const clauses = [eq(products.status, "active")];
  if (filters?.category) clauses.push(eq(products.category, filters.category));
  if (filters?.search) clauses.push(or(like(products.name, `%${filters.search}%`), like(products.subcategory, `%${filters.search}%`))!);
  const rows = await db.select().from(products).where(and(...clauses));
  const variants = await db.select().from(productVariants);
  const images = await db.select().from(productImages).orderBy(asc(productImages.sortOrder));
  const specs = await db.select().from(productSpecs).orderBy(asc(productSpecs.sortOrder));
  return rows.map((product) => ({ ...product, variants: variants.filter((variant) => variant.productId === product.id), images: images.filter((image) => image.productId === product.id), specs: specs.filter((spec) => spec.productId === product.id) }));
}

export async function getOrdersByWhatsapp(whatsapp: string) {
  const db = await getDb();
  if (!db) return [];
  const normalized = normalizeWhatsapp(whatsapp);
  const rows = await db.select().from(orders).where(or(eq(orders.whatsapp, normalized), eq(orders.whatsapp, whatsapp))).orderBy(desc(orders.createdAt));
  if (!rows.length) return [];
  const items = await db.select().from(orderItems).where(inArray(orderItems.orderId, rows.map((order) => order.id)));
  return rows.map((order) => ({ ...order, items: items.filter((item) => item.orderId === order.id) }));
}

export async function getBookingsByWhatsapp(whatsapp: string) {
  const db = await getDb();
  if (!db) return [];
  const normalized = normalizeWhatsapp(whatsapp);
  return db.select().from(bookings).where(or(eq(bookings.whatsapp, normalized), eq(bookings.whatsapp, whatsapp)));
}

export async function getPublicShippingRules() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(shippingRules).where(eq(shippingRules.active, true)).orderBy(asc(shippingRules.id));
}

export async function getAvailableSlotsForDate(date: string) {
  const db = await getDb();
  if (!db) return [];
  const parsed = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return [];
  return db.select().from(availableSlots).where(and(eq(availableSlots.weekday, parsed.getUTCDay()), eq(availableSlots.active, true))).orderBy(asc(availableSlots.time));
}

export async function getPublicGroomingServices() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(groomingServices).where(eq(groomingServices.active, true)).orderBy(asc(groomingServices.sortOrder), asc(groomingServices.id));
}

export async function calculateCoupon(code: string | undefined, subtotal: number) {
  if (!code) return { code: undefined, discount: 0 };
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const coupon = (await db.select().from(coupons).where(and(eq(coupons.code, code.trim().toUpperCase()), eq(coupons.active, true))).limit(1))[0];
  if (!coupon) throw new Error("Cupom inválido ou expirado");
  const expired = coupon.expiresAt && coupon.expiresAt.getTime() < Date.now();
  const exhausted = coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses;
  if (expired || exhausted) {
    await db.update(coupons).set({ active: false }).where(eq(coupons.id, coupon.id));
    throw new Error(expired ? "Cupom inválido ou expirado" : "Este cupom atingiu o limite de usos");
  }
  const value = Number(coupon.discountValue);
  const discount = coupon.discountType === "percentage" ? subtotal * value / 100 : Math.min(subtotal, value);
  return { code: coupon.code, discount: Number(discount.toFixed(2)) };
}

export async function createOrder(input: {
  customerName: string; whatsapp: string; cep?: string; street: string; number: string; neighborhood: string;
  city: string; state: string; complement?: string; paymentMethod: string; couponCode?: string;
  subtotal: string; shippingFee: string; discount: string; total: string;
  items: { productId: number; productName: string; variantLabel?: string; quantity: number; unitPrice: string }[];
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const productRows = await db.select().from(products);
  const variantRows = await db.select().from(productVariants);
  let subtotal = 0;
  const normalizedItems = input.items.map((item) => {
    const product = productRows.find((row) => row.id === item.productId && row.status === "active");
    const variant = variantRows.find((row) => row.productId === item.productId && (!item.variantLabel || row.label === item.variantLabel));
    if (!product || !variant || variant.stock < item.quantity) throw new Error(`Produto indisponível: ${item.productName}`);
    const unitPrice = Number(variant.price);
    subtotal += unitPrice * item.quantity;
    return { productId: product.id, productName: product.name, variantLabel: variant.label, quantity: item.quantity, unitPrice: unitPrice.toFixed(2) };
  });
  const rules = await db.select().from(shippingRules).where(eq(shippingRules.active, true));
  const neighborhood = input.neighborhood.trim().toLocaleLowerCase("pt-BR");
  const matchedRule = rules.find((rule) => rule.neighborhoods.split(",").some((item) => neighborhood.includes(item.trim().toLocaleLowerCase("pt-BR"))));
  const fallbackRule = rules.find((rule) => rule.label.toLocaleLowerCase("pt-BR").includes("demais"));
  const shippingFee = Number((matchedRule?.fee ?? fallbackRule?.fee ?? 0));
  const coupon = await calculateCoupon(input.couponCode, subtotal);
  const total = subtotal - coupon.discount + shippingFee;
  const createdOrder = await db.transaction(async (tx) => {
    await tx.update(orderNumberSequence).set({ nextNumber: sql`${orderNumberSequence.nextNumber} + 1` }).where(eq(orderNumberSequence.id, 1));
    const sequenceRow = (await tx.select({ nextNumber: orderNumberSequence.nextNumber }).from(orderNumberSequence).where(eq(orderNumberSequence.id, 1)).limit(1))[0];
    if (!sequenceRow) throw new Error("Sequência de pedidos indisponível");
    const orderNumber = Number(sequenceRow.nextNumber) - 1;
    const inserted = await tx.insert(orders).values({ orderNumber, customerName: input.customerName, whatsapp: normalizeWhatsapp(input.whatsapp), cep: input.cep || null, street: input.street, number: input.number, neighborhood: input.neighborhood, city: input.city, state: input.state, complement: input.complement || null, paymentMethod: input.paymentMethod, couponCode: coupon.code || null, subtotal: subtotal.toFixed(2), shippingFee: shippingFee.toFixed(2), discount: coupon.discount.toFixed(2), total: total.toFixed(2) });
    const createdOrderId = Number(inserted[0].insertId);
    if (normalizedItems.length) await tx.insert(orderItems).values(normalizedItems.map((item) => ({ ...item, orderId: createdOrderId, variantLabel: item.variantLabel || null })));
    if (coupon.code) {
      const now = new Date();
      const consumed = await tx.update(coupons).set({ usedCount: sql`${coupons.usedCount} + 1` }).where(and(eq(coupons.code, coupon.code), eq(coupons.active, true), or(isNull(coupons.maxUses), lt(coupons.usedCount, coupons.maxUses)), or(isNull(coupons.expiresAt), gt(coupons.expiresAt, now))));
      if (!consumed[0].affectedRows) throw new Error("Este cupom acabou de atingir o limite de usos. Tente finalizar novamente sem ele.");
      const updatedCoupon = (await tx.select({ maxUses: coupons.maxUses, usedCount: coupons.usedCount }).from(coupons).where(eq(coupons.code, coupon.code)).limit(1))[0];
      if (updatedCoupon?.maxUses !== null && updatedCoupon && updatedCoupon.usedCount >= updatedCoupon.maxUses) await tx.update(coupons).set({ active: false }).where(eq(coupons.code, coupon.code));
    }
    return { id: createdOrderId, orderNumber };
  });
  return { orderId: createdOrder.id, orderNumber: createdOrder.orderNumber, subtotal: subtotal.toFixed(2), shippingFee: shippingFee.toFixed(2), discount: coupon.discount.toFixed(2), total: total.toFixed(2), couponCode: coupon.code };
}

export async function createBooking(input: { customerName: string; whatsapp: string; petName: string; petSize: "small" | "medium" | "large"; serviceName: string; date: string; time: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const service = (await db.select().from(groomingServices).where(and(eq(groomingServices.name, input.serviceName), eq(groomingServices.active, true))).limit(1))[0];
  if (!service) throw new Error("Serviço indisponível");
  const parsed = new Date(`${input.date}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.getTime() < Date.now() - 86400000) throw new Error("Data inválida");
  const slot = (await db.select().from(availableSlots).where(and(eq(availableSlots.weekday, parsed.getUTCDay()), eq(availableSlots.time, input.time), eq(availableSlots.active, true))).limit(1))[0];
  if (!slot) throw new Error("Horário indisponível");
  const inserted = await db.insert(bookings).values({ ...input, whatsapp: normalizeWhatsapp(input.whatsapp), status: "requested" });
  return Number(inserted[0].insertId);
}

export async function adminListProducts(input?: { search?: string; status?: "active" | "inactive" }) {
  const db = await getDb();
  if (!db) return [];
  const filters = [];
  if (input?.status) filters.push(eq(products.status, input.status));
  if (input?.search) filters.push(or(like(products.name, `%${input.search}%`), like(products.slug, `%${input.search}%`))!);
  const rows = await db.select().from(products).where(filters.length ? and(...filters) : undefined).orderBy(desc(products.updatedAt));
  const variants = await db.select().from(productVariants);
  const images = await db.select().from(productImages).orderBy(asc(productImages.sortOrder));
  const specs = await db.select().from(productSpecs).orderBy(asc(productSpecs.sortOrder));
  return rows.map((product) => ({ ...product, variants: variants.filter((variant) => variant.productId === product.id), images: images.filter((image) => image.productId === product.id), specs: specs.filter((spec) => spec.productId === product.id) }));
}

export async function adminCreateProduct(input: { slug: string; name: string; category: string; subcategory: string; description?: string; status: "active" | "inactive"; variants: { label: string; sku: string; price: string; oldPrice?: string; stock: number }[]; images: { url: string; alt?: string; sortOrder: number; isCover: boolean }[]; specs: { label: string; value: string; sortOrder: number }[] }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const inserted = await db.insert(products).values({ slug: input.slug, name: input.name, category: input.category, subcategory: input.subcategory, description: input.description || null, status: input.status });
  const productId = Number(inserted[0].insertId);
  if (input.variants.length) await db.insert(productVariants).values(input.variants.map((variant) => ({ ...variant, productId, price: variant.price, oldPrice: variant.oldPrice || null })));
  if (input.images.length) await db.insert(productImages).values(input.images.map((image) => ({ ...image, productId, alt: image.alt || null })));
  if (input.specs.length) await db.insert(productSpecs).values(input.specs.map((spec) => ({ ...spec, productId })));
  return productId;
}

export async function adminUpdateProduct(input: { id: number; slug: string; name: string; category: string; subcategory: string; description?: string; status: "active" | "inactive"; variants: { id?: number; label: string; sku: string; price: string; oldPrice?: string; stock: number }[]; images: { url: string; alt?: string; sortOrder: number; isCover: boolean }[]; specs: { label: string; value: string; sortOrder: number }[] }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(products).set({ slug: input.slug, name: input.name, category: input.category, subcategory: input.subcategory, description: input.description || null, status: input.status }).where(eq(products.id, input.id));
  await db.delete(productVariants).where(eq(productVariants.productId, input.id));
  if (input.variants.length) await db.insert(productVariants).values(input.variants.map((variant) => ({ productId: input.id, label: variant.label, sku: variant.sku, price: variant.price, oldPrice: variant.oldPrice || null, stock: variant.stock })));
  await db.delete(productImages).where(eq(productImages.productId, input.id));
  if (input.images.length) await db.insert(productImages).values(input.images.map((image) => ({ ...image, productId: input.id, alt: image.alt || null })));
  await db.delete(productSpecs).where(eq(productSpecs.productId, input.id));
  if (input.specs.length) await db.insert(productSpecs).values(input.specs.map((spec) => ({ ...spec, productId: input.id })));
}

export async function adminDeleteProduct(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.delete(productVariants).where(eq(productVariants.productId, id));
  await db.delete(productImages).where(eq(productImages.productId, id));
  await db.delete(productSpecs).where(eq(productSpecs.productId, id));
  await db.delete(products).where(eq(products.id, id));
}

export async function getOrderById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const order = (await db.select().from(orders).where(eq(orders.id, id)).limit(1))[0];
  if (!order) return undefined;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, id));
  return { ...order, items };
}

export async function adminListOrders(input?: { status?: "received" | "preparing" | "out_for_delivery" | "delivered" | "cancelled"; search?: string }) {
  const db = await getDb();
  if (!db) return [];
  const search = input?.search?.trim();
  const orderSearch = search?.replace(/^#\s*/, "").trim() || "";
  const phoneDigits = orderSearch.replace(/\D/g, "");
  const searchNumber = /^\d+$/.test(orderSearch) ? Number(orderSearch) : undefined;
  const searchConditions = search ? [
    sql`LOWER(${orders.customerName}) LIKE LOWER(${`%${search}%`})`,
    ...(phoneDigits ? [like(orders.whatsapp, `%${phoneDigits}%`)] : []),
    ...(searchNumber && Number.isSafeInteger(searchNumber) ? [eq(orders.orderNumber, searchNumber)] : []),
    ...(searchNumber && Number.isSafeInteger(searchNumber) ? [eq(orders.id, searchNumber)] : []),
  ] : [];
  const filters = [
    ...(input?.status ? [eq(orders.status, input.status)] : []),
    ...(searchConditions.length ? [or(...searchConditions)!] : []),
  ];
  const rows = await db.select().from(orders).where(filters.length ? and(...filters) : undefined).orderBy(desc(orders.createdAt));
  if (!rows.length) return [];
  const items = await db.select().from(orderItems).where(inArray(orderItems.orderId, rows.map((order) => order.id)));
  return rows.map((order) => ({ ...order, items: items.filter((item) => item.orderId === order.id) }));
}

export async function adminUpdateOrderStatus(id: number, status: "received" | "preparing" | "out_for_delivery" | "delivered" | "cancelled") {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(orders).set({ status }).where(eq(orders.id, id));
}

export async function getBookingById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.select().from(bookings).where(eq(bookings.id, id)).limit(1))[0];
}
export async function adminListBookings(input?: { status?: "requested" | "confirmed" | "refused" | "completed"; search?: string }) {
  const db = await getDb();
  if (!db) return [];
  const filters = [];
  if (input?.status) filters.push(eq(bookings.status, input.status));
  if (input?.search) {
    const normalizedSearch = normalizeWhatsapp(input.search);
    const textFilters = [like(bookings.customerName, `%${input.search}%`), like(bookings.petName, `%${input.search}%`), like(bookings.serviceName, `%${input.search}%`)];
    if (normalizedSearch) textFilters.push(like(bookings.whatsapp, `%${normalizedSearch}%`));
    filters.push(or(...textFilters)!);
  }
  return db.select().from(bookings).where(filters.length ? and(...filters) : undefined).orderBy(asc(bookings.date), asc(bookings.time));
}

export async function adminUpdateBookingStatus(id: number, status: "requested" | "confirmed" | "refused" | "completed") {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(bookings).set({ status }).where(eq(bookings.id, id));
}

export async function adminListCoupons() {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  await db.update(coupons).set({ active: false }).where(and(eq(coupons.active, true), or(lte(coupons.expiresAt, now), and(isNotNull(coupons.maxUses), lte(coupons.maxUses, coupons.usedCount)))));
  return db.select().from(coupons).orderBy(desc(coupons.id));
}

export async function adminUpsertCoupon(input: { id?: number; code: string; discountType: "percentage" | "fixed"; discountValue: string; expiresAt: Date; maxUses: number | null; active: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (input.expiresAt < today) throw new Error("A data limite não pode ser anterior à data atual.");
  const duplicated = (await db.select({ id: coupons.id }).from(coupons).where(eq(coupons.code, input.code)).limit(1))[0];
  if (duplicated && duplicated.id !== input.id) throw new Error("Já existe um cupom com esse código.");
  const value = Number(input.discountValue);
  if (!Number.isFinite(value) || value <= 0) throw new Error("Informe um valor de desconto maior que zero.");
  if (input.discountType === "percentage" && value > 100) throw new Error("O desconto percentual não pode ser maior que 100%.");
  if (input.maxUses !== null && (!Number.isInteger(input.maxUses) || input.maxUses < 1)) throw new Error("O limite total de usos deve ser um número inteiro maior que zero.");
  if (input.id) await db.update(coupons).set({ code: input.code, discountType: input.discountType, discountValue: input.discountValue, expiresAt: input.expiresAt, maxUses: input.maxUses, active: input.active }).where(eq(coupons.id, input.id));
  else await db.insert(coupons).values({ code: input.code, discountType: input.discountType, discountValue: input.discountValue, expiresAt: input.expiresAt, maxUses: input.maxUses, active: input.active });
}

export async function adminDeleteCoupon(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.delete(coupons).where(eq(coupons.id, id));
}

export async function adminListShippingRules() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(shippingRules).orderBy(asc(shippingRules.id));
}

export async function adminUpsertShippingRule(input: { id?: number; label: string; neighborhoods: string; fee: string; active: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  if (input.id) await db.update(shippingRules).set({ label: input.label, neighborhoods: input.neighborhoods, fee: input.fee, active: input.active }).where(eq(shippingRules.id, input.id));
  else await db.insert(shippingRules).values({ label: input.label, neighborhoods: input.neighborhoods, fee: input.fee, active: input.active });
}

export async function adminDeleteShippingRule(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.delete(shippingRules).where(eq(shippingRules.id, id));
}

export async function adminListSlots() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(availableSlots).orderBy(asc(availableSlots.weekday), asc(availableSlots.time));
}

export async function adminUpsertSlot(input: { id?: number; weekday: number; time: string; active: boolean }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  if (input.id) await db.update(availableSlots).set({ weekday: input.weekday, time: input.time, active: input.active }).where(eq(availableSlots.id, input.id));
  else await db.insert(availableSlots).values({ weekday: input.weekday, time: input.time, active: input.active });
}

export async function adminDeleteSlot(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.delete(availableSlots).where(eq(availableSlots.id, id));
}

export async function adminListGroomingServices() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(groomingServices).orderBy(asc(groomingServices.sortOrder), asc(groomingServices.id));
}

export async function adminUpsertGroomingService(input: { id?: number; name: string; description?: string; priceSmall: string; priceMedium: string; priceLarge: string; active: boolean; sortOrder: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const values = { name: input.name, description: input.description || null, priceSmall: input.priceSmall, priceMedium: input.priceMedium, priceLarge: input.priceLarge, active: input.active, sortOrder: input.sortOrder };
  if (input.id) await db.update(groomingServices).set(values).where(eq(groomingServices.id, input.id));
  else await db.insert(groomingServices).values(values);
}

export async function adminDeleteGroomingService(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.delete(groomingServices).where(eq(groomingServices.id, id));
}
