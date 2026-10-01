import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function contextWithRole(role: "user" | "admin"): TrpcContext {
  return {
    user: { id: 1, openId: `test-${role}`, email: "admin@example.com", name: "Test", loginMethod: "test", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
    adminSession: role === "admin",
  };
}

describe("admin authorization", () => {
  it("rejects admin queries for regular users", async () => {
    const caller = appRouter.createCaller(contextWithRole("user"));
    await expect(caller.admin.products.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows admin queries when role is admin", async () => {
    const caller = appRouter.createCaller(contextWithRole("admin"));
    const products = await caller.admin.products.list();
    expect(Array.isArray(products)).toBe(true);
    expect(products.length).toBeGreaterThan(0);
  });
  it("returns persisted order items and accepts the cancelled status filter", async () => {
    const caller = appRouter.createCaller(contextWithRole("admin"));
    const orders = await caller.admin.orders.list();
    expect(Array.isArray(orders)).toBe(true);
    if (orders.length) expect(Array.isArray(orders[0].items)).toBe(true);
    const cancelled = await caller.admin.orders.list({ status: "cancelled" });
    expect(Array.isArray(cancelled)).toBe(true);
    const byName = await caller.admin.orders.list({ search: "Denisson" });
    expect(Array.isArray(byName)).toBe(true);
    const byLowerName = await caller.admin.orders.list({ search: "ana" });
    expect(byLowerName.some((order) => order.customerName.toLocaleLowerCase().includes("ana"))).toBe(true);
    if (orders.length) {
      const byNumber = await caller.admin.orders.list({ search: String(orders[0].id) });
      expect(byNumber.some((order) => order.id === orders[0].id)).toBe(true);
      const byPublicNumber = await caller.admin.orders.list({ search: `#${orders[0].orderNumber}` });
      expect(byPublicNumber.some((order) => order.orderNumber === orders[0].orderNumber)).toBe(true);
      const legacyOrder = orders.find((order) => order.id !== order.orderNumber);
      if (legacyOrder) {
        const byLegacyNumber = await caller.admin.orders.list({ search: `#${legacyOrder.id}` });
        expect(byLegacyNumber.some((order) => order.id === legacyOrder.id)).toBe(true);
      }
    }
  });
});
