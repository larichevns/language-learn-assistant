import type { NextRequest } from 'next/server';
import { ApiError, handleApiError, successResponse } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/client';
import { summarizeThreadIfNeeded } from '@/lib/ai/thread/summarize';

/**
 * Manual / cron trigger for the rolling thread summary. The chat route fires the
 * same `summarizeThreadIfNeeded` automatically after each successful turn; this
 * endpoint exists for an explicit "summarize now" action or a nightly sweep.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const thread = await prisma.chatThread.findFirst({ where: { id, userId: user.userId } });
    if (!thread) throw new ApiError('not_found', 'Thread not found', 404);

    const result = await summarizeThreadIfNeeded(id, user.userId);
    return successResponse(result);
  } catch (e) {
    return handleApiError(e);
  }
}
