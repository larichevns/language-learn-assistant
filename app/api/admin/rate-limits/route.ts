import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { ApiError, handleApiError, successResponse } from '@/lib/api/response';
import { requireAdmin } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/client';

export async function GET() {
  try {
    await requireAdmin();
    return successResponse(await prisma.rateLimit.findMany({ orderBy: [{ tier: 'asc' }, { operationType: 'asc' }] }));
  } catch (e) {
    return handleApiError(e);
  }
}

const PutBody = z.object({
  tier: z.string(),
  operationType: z.string().default('all'),
  maxRequestsPerMinute: z.number().int().nonnegative(),
  maxRequestsPerDay: z.number().int().nonnegative(),
  maxTokensPerDay: z.number().int().nonnegative(),
});

export async function PUT(req: NextRequest) {
  try {
    await requireAdmin();
    const parsed = PutBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return handleApiError(new ApiError('invalid_input', 'Invalid rate limit', 400));
    const d = parsed.data;
    const row = await prisma.rateLimit.upsert({
      where: { tier_operationType: { tier: d.tier, operationType: d.operationType } },
      create: d,
      update: {
        maxRequestsPerMinute: d.maxRequestsPerMinute,
        maxRequestsPerDay: d.maxRequestsPerDay,
        maxTokensPerDay: d.maxTokensPerDay,
      },
    });
    return successResponse(row);
  } catch (e) {
    return handleApiError(e);
  }
}
