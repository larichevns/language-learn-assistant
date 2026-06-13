import { Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';
import { handleApiError, successResponse } from '@/lib/api/response';
import { requireAdmin } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/client';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const url = new URL(req.url);
    const days = Math.min(365, Math.max(1, Number(url.searchParams.get('days') ?? 30) || 30));
    const since = new Date(Date.now() - days * 86_400_000);
    const where: Prisma.UsageEventWhereInput = { createdAt: { gte: since } };

    const [totals, byFeature, byModel, recentErrors] = await Promise.all([
      prisma.usageEvent.aggregate({
        _count: { _all: true },
        _sum: { inputTokens: true, outputTokens: true, cachedTokens: true, estimatedCostUsd: true },
        where,
      }),
      prisma.usageEvent.groupBy({
        by: ['featureSlug'],
        _count: { _all: true },
        _sum: { inputTokens: true, outputTokens: true, estimatedCostUsd: true },
        where,
        orderBy: { _count: { featureSlug: 'desc' } },
      }),
      prisma.usageEvent.groupBy({
        by: ['modelId'],
        _count: { _all: true },
        _sum: { estimatedCostUsd: true },
        where,
      }),
      prisma.usageEvent.findMany({
        where: { ...where, status: 'error' },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, featureSlug: true, modelId: true, errorMessage: true, createdAt: true },
      }),
    ]);

    return successResponse({ days, totals, byFeature, byModel, recentErrors });
  } catch (e) {
    return handleApiError(e);
  }
}
