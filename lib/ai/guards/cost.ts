/**
 * Daily spend ceiling per tier (24h rolling, foreground only). Free-tier Gemini
 * costs ~$0, but we still meter so the guard is real when paid models are added.
 */
import { prisma } from '../../db/client';

const DAILY_USD_LIMIT: Record<string, number> = {
  free: 1.0,
  pro: 50.0,
  admin: 1000.0,
};

export interface BudgetResult {
  allowed: boolean;
  spent: number;
  limit: number;
}

export async function guardDailyBudget(userId: string, tier: string): Promise<BudgetResult> {
  const since = new Date(Date.now() - 86_400_000);
  const agg = await prisma.usageEvent.aggregate({
    _sum: { estimatedCostUsd: true },
    where: { userId, isBackground: false, createdAt: { gte: since } },
  });
  const spent = agg._sum.estimatedCostUsd ?? 0;
  const limit = DAILY_USD_LIMIT[tier] ?? DAILY_USD_LIMIT.free!;
  return { allowed: spent < limit, spent, limit };
}
