import { TRPCError } from "@trpc/server";
import { middleware } from "./_core/trpc";

export const MAX_MAP_ENTRIES = 10_000;

type AttemptRecord = {
  timestamps: number[];
};

const orderAttempts = new Map<string, AttemptRecord>();
const bookingAttempts = new Map<string, AttemptRecord>();
const couponAttempts = new Map<string, AttemptRecord>();

function cleanRecord(
  map: Map<string, AttemptRecord>,
  key: string,
  windowMs: number,
  now: number,
): AttemptRecord | null {
  const record = map.get(key);
  if (!record) return null;
  record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);
  if (record.timestamps.length === 0) {
    map.delete(key);
    return null;
  }
  return record;
}

function enforceCapacity(map: Map<string, AttemptRecord>): void {
  while (map.size > MAX_MAP_ENTRIES) {
    const oldestKey = map.keys().next().value;
    if (oldestKey !== undefined) {
      map.delete(oldestKey);
    } else {
      break;
    }
  }
}

export function resolveClientIp(req?: any): string {
  if (!req) return "unknown";
  let ip: string | undefined;

  if (typeof req.ip === "string" && req.ip.trim()) {
    ip = req.ip.trim();
  } else if (typeof req.socket?.remoteAddress === "string" && req.socket.remoteAddress.trim()) {
    ip = req.socket.remoteAddress.trim();
  }

  if (!ip) {
    return "unknown";
  }

  if (ip.startsWith("::ffff:")) {
    ip = ip.slice(7);
  }

  return ip;
}

export function checkAndRecordRateLimit(
  map: Map<string, AttemptRecord>,
  key: string,
  maxRequests: number,
  windowMs: number,
  actionName: string,
): void {
  const now = Date.now();
  let record = cleanRecord(map, key, windowMs, now);

  if (record && record.timestamps.length >= maxRequests) {
    console.warn(`[RateLimit] Bloqueio por excesso de requisições (ação: ${actionName})`);
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Muitas tentativas. Tente novamente em alguns minutos.",
    });
  }

  if (!record) {
    record = { timestamps: [] };
    map.set(key, record);
  }

  record.timestamps.push(now);
  enforceCapacity(map);
}

export const rateLimitCreateOrder = middleware(async ({ ctx, next }) => {
  const ip = resolveClientIp(ctx.req);
  checkAndRecordRateLimit(orderAttempts, ip, 20, 60 * 60 * 1000, "checkout.createOrder");
  return next();
});

export const rateLimitBookingCreate = middleware(async ({ ctx, next }) => {
  const ip = resolveClientIp(ctx.req);
  checkAndRecordRateLimit(bookingAttempts, ip, 20, 60 * 60 * 1000, "booking.create");
  return next();
});

export const rateLimitValidateCoupon = middleware(async ({ ctx, next }) => {
  const ip = resolveClientIp(ctx.req);
  checkAndRecordRateLimit(couponAttempts, ip, 30, 15 * 60 * 1000, "checkout.validateCoupon");
  return next();
});

export function resetRateLimits(): void {
  orderAttempts.clear();
  bookingAttempts.clear();
  couponAttempts.clear();
}

