import { boolean, decimal, int, mysqlEnum, mysqlTable, text, timestamp, unique, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const adminUsers = mysqlTable("admin_users", {
  id: int("id").autoincrement().primaryKey(),
  username: varchar("username", { length: 160 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 255 }).notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastLoginAt: timestamp("lastLoginAt"),
});

export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 180 }).notNull().unique(),
  name: varchar("name", { length: 180 }).notNull(),
  category: varchar("category", { length: 80 }).notNull(),
  subcategory: varchar("subcategory", { length: 100 }).notNull(),
  description: text("description"),
  status: mysqlEnum("status", ["active", "inactive"]).default("active").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const productVariants = mysqlTable("product_variants", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  label: varchar("label", { length: 80 }).notNull(),
  sku: varchar("sku", { length: 80 }).notNull().unique(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  oldPrice: decimal("oldPrice", { precision: 10, scale: 2 }),
  stock: int("stock").default(0).notNull(),
});

export const productImages = mysqlTable("product_images", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  url: text("url").notNull(),
  alt: varchar("alt", { length: 180 }),
  sortOrder: int("sortOrder").default(0).notNull(),
  isCover: boolean("isCover").default(false).notNull(),
});

export const productSpecs = mysqlTable("product_specs", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("productId").notNull(),
  label: varchar("label", { length: 80 }).notNull(),
  value: varchar("value", { length: 180 }).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
});

export const coupons = mysqlTable("coupons", {
  id: int("id").autoincrement().primaryKey(),
  code: varchar("code", { length: 40 }).notNull().unique(),
  discountType: mysqlEnum("discountType", ["percentage", "fixed"]).notNull(),
  discountValue: decimal("discountValue", { precision: 10, scale: 2 }).notNull(),
  expiresAt: timestamp("expiresAt"),
  maxUses: int("maxUses"),
  usedCount: int("usedCount").default(0).notNull(),
  active: boolean("active").default(true).notNull(),
});

export const shippingRules = mysqlTable("shipping_rules", {
  id: int("id").autoincrement().primaryKey(),
  label: varchar("label", { length: 100 }).notNull(),
  neighborhoods: text("neighborhoods").notNull(),
  fee: decimal("fee", { precision: 10, scale: 2 }).notNull(),
  active: boolean("active").default(true).notNull(),
});

export const orderNumberSequence = mysqlTable("order_number_sequence", {
  id: int("id").primaryKey(),
  nextNumber: int("nextNumber").notNull(),
});

export const orders = mysqlTable("orders", {
  id: int("id").autoincrement().primaryKey(),
  orderNumber: int("orderNumber").notNull().unique(),
  customerName: varchar("customerName", { length: 160 }).notNull(),
  whatsapp: varchar("whatsapp", { length: 40 }).notNull(),
  cep: varchar("cep", { length: 12 }),
  street: varchar("street", { length: 180 }),
  number: varchar("number", { length: 30 }),
  neighborhood: varchar("neighborhood", { length: 100 }),
  city: varchar("city", { length: 100 }),
  state: varchar("state", { length: 2 }),
  complement: varchar("complement", { length: 180 }),
  paymentMethod: varchar("paymentMethod", { length: 50 }).notNull(),
  couponCode: varchar("couponCode", { length: 40 }),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  shippingFee: decimal("shippingFee", { precision: 10, scale: 2 }).notNull(),
  discount: decimal("discount", { precision: 10, scale: 2 }).default("0").notNull(),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  status: mysqlEnum("status", ["received", "preparing", "out_for_delivery", "delivered", "cancelled"]).default("received").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const orderItems = mysqlTable("order_items", {
  id: int("id").autoincrement().primaryKey(),
  orderId: int("orderId").notNull(),
  productId: int("productId").notNull(),
  variantId: int("variantId"),
  productName: varchar("productName", { length: 180 }).notNull(),
  variantLabel: varchar("variantLabel", { length: 80 }),
  quantity: int("quantity").notNull(),
  unitPrice: decimal("unitPrice", { precision: 10, scale: 2 }).notNull(),
});

export const bookings = mysqlTable("bookings", {
  id: int("id").autoincrement().primaryKey(),
  customerName: varchar("customerName", { length: 160 }).notNull(),
  whatsapp: varchar("whatsapp", { length: 40 }).notNull(),
  petName: varchar("petName", { length: 100 }).notNull(),
  serviceName: varchar("serviceName", { length: 120 }).notNull(),
  petSize: mysqlEnum("petSize", ["small", "medium", "large"]).default("medium").notNull(),
  date: varchar("date", { length: 12 }).notNull(),
  time: varchar("time", { length: 8 }).notNull(),
  status: mysqlEnum("status", ["requested", "confirmed", "refused", "completed"]).default("requested").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const availableSlots = mysqlTable("available_slots", {
  id: int("id").autoincrement().primaryKey(),
  weekday: int("weekday").notNull(),
  time: varchar("time", { length: 8 }).notNull(),
  active: boolean("active").default(true).notNull(),
}, (table) => ({
  weekdayTimeUnique: unique("available_slots_weekday_time").on(table.weekday, table.time),
}));

export const groomingServices = mysqlTable("grooming_services", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 120 }).notNull().unique(),
  description: varchar("description", { length: 220 }),
  priceSmall: decimal("priceSmall", { precision: 10, scale: 2 }).notNull(),
  priceMedium: decimal("priceMedium", { precision: 10, scale: 2 }).notNull(),
  priceLarge: decimal("priceLarge", { precision: 10, scale: 2 }).notNull(),
  active: boolean("active").default(true).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type AdminUser = typeof adminUsers.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type GroomingService = typeof groomingServices.$inferSelect;
