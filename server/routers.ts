import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import { ADMIN_COOKIE, createAdminToken, getAdminByUsername, markAdminLogin, verifyAdminPassword } from "./adminAuth";
import { isValidWhatsapp, normalizeWhatsapp } from "../shared/phone";
import {
  adminCreateProduct, adminDeleteCoupon, adminDeleteGroomingService, adminDeleteProduct, adminDeleteShippingRule, adminDeleteSlot,
  adminListBookings, adminListCoupons, adminListOrders, adminListProducts, adminListShippingRules, adminListSlots,
  adminListGroomingServices, adminUpdateBookingStatus, adminUpdateOrderStatus, adminUpdateProduct, adminUpsertCoupon, adminUpsertGroomingService, adminUpsertShippingRule,
  adminUpsertSlot, calculateCoupon, createBooking, createOrder, getAvailableSlotsForDate, getBookingsByWhatsapp, getOrdersByWhatsapp, getPublicGroomingServices, getPublicShippingRules, listActiveProducts,
} from "./db";

const productImage = z.object({ url: z.string().startsWith("/uploads/").refine((url) => url.toLowerCase().endsWith(".webp")), alt: z.string().optional(), sortOrder: z.number().int().min(0), isCover: z.boolean() });
const productSpec = z.object({ label: z.string().min(1), value: z.string().min(1), sortOrder: z.number().int().min(0) });
const productVariant = z.object({ id: z.number().optional(), label: z.string().min(1), sku: z.string().min(1), price: z.string().regex(/^\d+(\.\d{1,2})?$/), oldPrice: z.string().regex(/^\d+(\.\d{1,2})?$/).optional().or(z.literal("")), stock: z.number().int().min(0) });
const productInput = z.object({ slug: z.string().min(2).regex(/^[a-z0-9-]+$/), name: z.string().min(2), category: z.string().min(2), subcategory: z.string().min(2), description: z.string().optional(), status: z.enum(["active", "inactive"]), variants: z.array(productVariant).min(1), images: z.array(productImage).max(10), specs: z.array(productSpec).max(30) });
const adminStatus = z.enum(["received", "preparing", "out_for_delivery", "delivered", "cancelled"]);
const bookingStatus = z.enum(["requested", "confirmed", "refused", "completed"]);
const whatsappInput = z.string().trim().refine(isValidWhatsapp, "Informe um WhatsApp válido com DDD.").transform(normalizeWhatsapp);

export const appRouter = router({
  system: systemRouter,
  health: publicProcedure.query(() => ({ ok: true, service: "amopets", demo: false })),
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => { const cookieOptions = getSessionCookieOptions(ctx.req); ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 }); return { success: true } as const; }),
  }),
  catalog: router({ list: publicProcedure.input(z.object({ category: z.string().optional(), search: z.string().optional() }).optional()).query(({ input }) => listActiveProducts(input)) }),
  account: router({ orders: publicProcedure.input(z.object({ whatsapp: whatsappInput })).query(({ input }) => getOrdersByWhatsapp(input.whatsapp)), bookings: publicProcedure.input(z.object({ whatsapp: whatsappInput })).query(({ input }) => getBookingsByWhatsapp(input.whatsapp)) }),
  checkout: router({
    validateCoupon: publicProcedure.input(z.object({ code: z.string().min(2), subtotal: z.number().nonnegative() })).mutation(({ input }) => calculateCoupon(input.code, input.subtotal)),
    createOrder: publicProcedure.input(z.object({ customerName: z.string().min(2), whatsapp: whatsappInput, cep: z.string().optional(), street: z.string().min(2), number: z.string().min(1), neighborhood: z.string().min(2), city: z.string().min(2), state: z.string().length(2), complement: z.string().optional(), paymentMethod: z.string().min(2), couponCode: z.string().optional(), subtotal: z.string(), shippingFee: z.string(), discount: z.string(), total: z.string(), items: z.array(z.object({ productId: z.number().int().positive(), productName: z.string(), variantLabel: z.string().optional(), quantity: z.number().int().positive(), unitPrice: z.string() })).min(1) })).mutation(({ input }) => createOrder(input)),
  }),
  booking: router({ services: publicProcedure.query(() => getPublicGroomingServices()), slots: publicProcedure.input(z.object({ date: z.string().min(8) })).query(({ input }) => getAvailableSlotsForDate(input.date)), create: publicProcedure.input(z.object({ customerName: z.string().min(2), whatsapp: whatsappInput, petName: z.string().min(1), petSize: z.enum(["small", "medium", "large"]), serviceName: z.string().min(2), date: z.string().min(8), time: z.string().regex(/^\d{2}:\d{2}$/) })).mutation(({ input }) => createBooking(input)) }),
  shipping: router({ rules: publicProcedure.query(() => getPublicShippingRules()) }),
  admin: router({
    auth: router({
      me: publicProcedure.query(({ ctx }) => ctx.adminSession ? ctx.user : null),
      login: publicProcedure.input(z.object({ username: z.string().email(), password: z.string().min(8) })).mutation(async ({ ctx, input }) => { const admin = await getAdminByUsername(input.username); if (!admin || !verifyAdminPassword(input.password, admin.passwordHash) || !admin.active) throw new Error("Usuário ou senha inválidos."); const cookieOptions = getSessionCookieOptions(ctx.req); ctx.res.cookie(ADMIN_COOKIE, createAdminToken(admin.id), { ...cookieOptions, maxAge: 12 * 60 * 60 * 1000 }); await markAdminLogin(admin.id); return { id: admin.id, name: admin.name, username: admin.username }; }),
      logout: publicProcedure.mutation(({ ctx }) => { const cookieOptions = getSessionCookieOptions(ctx.req); ctx.res.clearCookie(ADMIN_COOKIE, { ...cookieOptions, maxAge: -1 }); return { success: true } as const; }),
    }),
    products: router({
      list: adminProcedure.input(z.object({ search: z.string().optional(), status: z.enum(["active", "inactive"]).optional() }).optional()).query(({ input }) => adminListProducts(input)),
      create: adminProcedure.input(productInput).mutation(({ input }) => adminCreateProduct(input)),
      update: adminProcedure.input(productInput.extend({ id: z.number().int().positive() })).mutation(({ input }) => adminUpdateProduct(input)),
      remove: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ input }) => adminDeleteProduct(input.id)),
    }),
    orders: router({ list: adminProcedure.input(z.object({ status: adminStatus.optional(), search: z.string().trim().optional() }).optional()).query(({ input }) => adminListOrders(input)), updateStatus: adminProcedure.input(z.object({ id: z.number().int().positive(), status: adminStatus })).mutation(({ input }) => adminUpdateOrderStatus(input.id, input.status)) }),
    bookings: router({ list: adminProcedure.input(z.object({ status: bookingStatus.optional(), search: z.string().trim().optional() }).optional()).query(({ input }) => adminListBookings(input)), updateStatus: adminProcedure.input(z.object({ id: z.number().int().positive(), status: bookingStatus })).mutation(({ input }) => adminUpdateBookingStatus(input.id, input.status)) }),
    coupons: router({ list: adminProcedure.query(() => adminListCoupons()), upsert: adminProcedure.input(z.object({ id: z.number().int().positive().optional(), code: z.string({ error: "Informe o código do cupom." }).trim().min(2, "O código deve ter pelo menos 2 caracteres.").transform((value) => value.toUpperCase()), discountType: z.enum(["percentage", "fixed"], { error: "Selecione o tipo de desconto." }), discountValue: z.string({ error: "Informe o valor do desconto." }).trim().min(1, "Informe o valor do desconto.").regex(/^\d+(\.\d{1,2})?$/, "Informe um valor numérico válido."), expiresAt: z.coerce.date({ error: "Informe a data limite." }), maxUses: z.string({ error: "Informe o limite de usos ou deixe em branco para uso ilimitado." }).trim().regex(/^\d*$/, "O limite de usos deve ser um número inteiro.") , active: z.boolean() })).mutation(({ input }) => adminUpsertCoupon({ ...input, maxUses: input.maxUses ? Number(input.maxUses) : null })), remove: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ input }) => adminDeleteCoupon(input.id)) }),
    shipping: router({ list: adminProcedure.query(() => adminListShippingRules()), upsert: adminProcedure.input(z.object({ id: z.number().int().positive().optional(), label: z.string().min(2), neighborhoods: z.string().min(2), fee: z.string().regex(/^\d+(\.\d{1,2})?$/), active: z.boolean() })).mutation(({ input }) => adminUpsertShippingRule(input)), remove: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ input }) => adminDeleteShippingRule(input.id)) }),
    slots: router({ list: adminProcedure.query(() => adminListSlots()), upsert: adminProcedure.input(z.object({ id: z.number().int().positive().optional(), weekday: z.number().int().min(0).max(6), time: z.string().regex(/^\d{2}:\d{2}$/), active: z.boolean() })).mutation(({ input }) => adminUpsertSlot(input)), remove: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ input }) => adminDeleteSlot(input.id)) }),
    services: router({ list: adminProcedure.query(() => adminListGroomingServices()), upsert: adminProcedure.input(z.object({ id: z.number().int().positive().optional(), name: z.string().min(2), description: z.string().optional(), priceSmall: z.string().regex(/^\d+(\.\d{1,2})?$/), priceMedium: z.string().regex(/^\d+(\.\d{1,2})?$/), priceLarge: z.string().regex(/^\d+(\.\d{1,2})?$/), active: z.boolean(), sortOrder: z.number().int().min(0) })).mutation(({ input }) => adminUpsertGroomingService(input)), remove: adminProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ input }) => adminDeleteGroomingService(input.id)) }),
  }),
});

export type AppRouter = typeof appRouter;
