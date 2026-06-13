import { Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';
import { handleApiError, successResponse } from '@/lib/api/response';
import { requireAdmin } from '@/lib/auth/guards';
import { listResult, parsePagination } from '@/lib/api/pagination';
import { prisma } from '@/lib/db/client';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const url = new URL(req.url);
    const p = parsePagination(url);
    const q = url.searchParams.get('q');
    const where: Prisma.UserWhereInput = q
      ? { OR: [{ email: { contains: q, mode: 'insensitive' } }, { name: { contains: q, mode: 'insensitive' } }] }
      : {};
    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: p.skip,
        take: p.take,
        select: { id: true, email: true, name: true, role: true, tier: true, createdAt: true },
      }),
      prisma.user.count({ where }),
    ]);
    return successResponse(listResult(items, total, p));
  } catch (e) {
    return handleApiError(e);
  }
}
