import { describe, expect, it } from "vitest";
import { shouldReactivateExpiredCoupon } from "./db";

describe("coupon reactivation", () => {
  const now = new Date("2026-10-09T12:00:00.000Z");

  it("reactivates an expired inactive coupon when the new date is valid", () => {
    expect(shouldReactivateExpiredCoupon({ active: false, expiresAt: new Date("2026-10-01T23:59:59.000Z"), usedCount: 0 }, new Date("2026-10-31T23:59:59.000Z"), null, now)).toBe(true);
  });

  it("does not reactivate a coupon that already reached its usage limit", () => {
    expect(shouldReactivateExpiredCoupon({ active: false, expiresAt: new Date("2026-10-01T23:59:59.000Z"), usedCount: 5 }, new Date("2026-10-31T23:59:59.000Z"), 5, now)).toBe(false);
  });

  it("does not reactivate a coupon that was manually inactive without an expired date", () => {
    expect(shouldReactivateExpiredCoupon({ active: false, expiresAt: new Date("2026-12-01T23:59:59.000Z"), usedCount: 0 }, new Date("2026-12-31T23:59:59.000Z"), null, now)).toBe(false);
  });
});
