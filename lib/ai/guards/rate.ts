/**
 * In-memory rate limiter (dev). Per-user, per-operation fixed windows (minute +
 * day). Limits come from the RateLimit table by tier, with hardcoded fallbacks.
 * Swap the store for Upstash in production (see post-mvp-backlog).
 */
import { prisma } from '../../db/client';

interface Window {
  count: number;
  resetAt: number;
}

const minuteWindows = new Map<string, Window>();
const dayWindows = new Map<string, Window>();

interface Limit {
  perMinute: number;
  perDay: number;
}
const DEFAULT_LIMITS: Record<string, Limit> = {
  free: { perMinute: 8, perDay: 300 },
  pro: { perMinute: 30, perDay: 5000 },
  admin: { perMinute: 120, perDay: 100000 },
};

const limitCache = new Map<string, { limit: Limit; cachedAt: number }>();
const LIMIT_TTL_MS = 60_000;

async function getLimit(tier: string, operationType: string): Promise<Limit> {
  const key = `${tier}:${operationType}`;
  const cached = limitCache.get(key);
  if (cached && Date.now() - cached.cachedAt < LIMIT_TTL_MS) return cached.limit;

  const row =
    (await prisma.rateLimit.findUnique({ where: { tier_operationType: { tier, operationType } } })) ??
    (await prisma.rateLimit.findUnique({ where: { tier_operationType: { tier, operationType: 'all' } } }));

  const limit: Limit = row
    ? { perMinute: row.maxRequestsPerMinute, perDay: row.maxRequestsPerDay }
    : DEFAULT_LIMITS[tier] ?? DEFAULT_LIMITS.free!;

  limitCache.set(key, { limit, cachedAt: Date.now() });
  return limit;
}

function hit(store: Map<string, Window>, key: string, windowMs: number, max: number): { allowed: boolean; resetAt: number } {
  const now = Date.now();
  const w = store.get(key);
  if (!w || now >= w.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, resetAt: now + windowMs };
  }
  w.count += 1;
  return { allowed: w.count <= max, resetAt: w.resetAt };
}

export interface RateResult {
  allowed: boolean;
  retryAfterMs?: number;
  scope?: 'minute' | 'day';
}

export async function guardRate(userId: string, operationType: string, tier: string): Promise<RateResult> {
  const limit = await getLimit(tier, operationType);
  const key = `${userId}:${operationType}`;

  const minute = hit(minuteWindows, key, 60_000, limit.perMinute);
  if (!minute.allowed) {
    return { allowed: false, retryAfterMs: Math.max(0, minute.resetAt - Date.now()), scope: 'minute' };
  }
  const day = hit(dayWindows, key, 86_400_000, limit.perDay);
  if (!day.allowed) {
    return { allowed: false, retryAfterMs: Math.max(0, day.resetAt - Date.now()), scope: 'day' };
  }
  return { allowed: true };
}
