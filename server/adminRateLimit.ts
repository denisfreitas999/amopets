import { TRPCError } from "@trpc/server";

export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutos
export const MAX_FAILED_ATTEMPTS = 5;
export const MAX_MAP_ENTRIES = 10_000;

type AttemptRecord = {
  timestamps: number[];
};

const ipAttempts = new Map<string, AttemptRecord>();
const userAttempts = new Map<string, AttemptRecord>();

export function normalizeUsername(username: string): string {
  return username.trim().toLowerCase();
}

function cleanRecord(map: Map<string, AttemptRecord>, key: string, now: number): AttemptRecord | null {
  const record = map.get(key);
  if (!record) return null;
  record.timestamps = record.timestamps.filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);
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

export function resolveClientIp(reqIp: string | undefined | null): string {
  if (!reqIp || typeof reqIp !== "string" || !reqIp.trim()) {
    return "unknown";
  }
  return reqIp.trim();
}

export function checkLoginRateLimit(ip: string, username: string): void {
  const now = Date.now();
  const normalizedUser = normalizeUsername(username);

  const ipRecord = cleanRecord(ipAttempts, ip, now);
  if (ipRecord && ipRecord.timestamps.length >= MAX_FAILED_ATTEMPTS) {
    console.warn("[AdminAuth] Bloqueio por excesso de tentativas de login (motivo: limite por IP atingido)");
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Muitas tentativas de login. Tente novamente em 15 minutos.",
    });
  }

  const userRecord = cleanRecord(userAttempts, normalizedUser, now);
  if (userRecord && userRecord.timestamps.length >= MAX_FAILED_ATTEMPTS) {
    console.warn("[AdminAuth] Bloqueio por excesso de tentativas de login (motivo: limite por credencial atingido)");
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Muitas tentativas de login. Tente novamente em 15 minutos.",
    });
  }
}

export function recordLoginFailure(ip: string, username: string): void {
  const now = Date.now();
  const normalizedUser = normalizeUsername(username);

  let ipRecord = cleanRecord(ipAttempts, ip, now);
  if (!ipRecord) {
    ipRecord = { timestamps: [] };
    ipAttempts.set(ip, ipRecord);
  }
  ipRecord.timestamps.push(now);
  enforceCapacity(ipAttempts);

  let userRecord = cleanRecord(userAttempts, normalizedUser, now);
  if (!userRecord) {
    userRecord = { timestamps: [] };
    userAttempts.set(normalizedUser, userRecord);
  }
  userRecord.timestamps.push(now);
  enforceCapacity(userAttempts);
}

export function clearLoginRateLimit(ip: string, username: string): void {
  const normalizedUser = normalizeUsername(username);
  ipAttempts.delete(ip);
  userAttempts.delete(normalizedUser);
}

export function resetAllRateLimits(): void {
  ipAttempts.clear();
  userAttempts.clear();
}

export function getRateLimitMapSizes(): { ipCount: number; userCount: number } {
  return {
    ipCount: ipAttempts.size,
    userCount: userAttempts.size,
  };
}
