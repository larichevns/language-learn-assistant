import type { NextRequest } from 'next/server';
import { handleApiError, successResponse } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/client';

// Chronological journal feed (most recent first).
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit') ?? 50) || 50));
    const items = await prisma.timelineEvent.findMany({
      where: { userId: user.userId },
      orderBy: { occurredAt: 'desc' },
      take: limit,
    });
    return successResponse({ items, count: items.length });
  } catch (e) {
    return handleApiError(e);
  }
}
