import type { NextRequest } from 'next/server';
import { handleApiError, successResponse } from '@/lib/api/response';
import { requireAdmin } from '@/lib/auth/guards';
import { listResult, parsePagination } from '@/lib/api/pagination';
import { prisma } from '@/lib/db/client';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const p = parsePagination(new URL(req.url));
    const [items, total] = await Promise.all([
      prisma.abuseEvent.findMany({
        orderBy: { createdAt: 'desc' },
        skip: p.skip,
        take: p.take,
        include: { user: { select: { id: true, email: true } } },
      }),
      prisma.abuseEvent.count(),
    ]);
    return successResponse(listResult(items, total, p));
  } catch (e) {
    return handleApiError(e);
  }
}
