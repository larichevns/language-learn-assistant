import type { NextRequest } from 'next/server';
import { ApiError, handleApiError, successResponse } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/client';

/**
 * Soft-reset ("New chat") for a scope's thread. The thread row is unique per
 * scope, so it is reused — we hide the current turns instead of deleting them
 * ("DB is the memory"): mark them isSummarized so they drop out of both the
 * envelope window and the resolve display, clear the rolling summary, and
 * discard the conversation's pending proposals. Nothing leaves the database.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const thread = await prisma.chatThread.findFirst({ where: { id, userId: user.userId } });
    if (!thread) throw new ApiError('not_found', 'Thread not found', 404);

    const [hidden] = await prisma.$transaction([
      prisma.chatMessage.updateMany({
        where: { threadId: id, isSummarized: false },
        data: { isSummarized: true },
      }),
      prisma.chatThread.update({
        where: { id },
        data: { threadSummary: null, summaryWatermark: 0 },
      }),
      prisma.proposal.updateMany({
        where: { threadId: id, status: 'PENDING' },
        data: { status: 'DISCARDED' },
      }),
    ]);

    return successResponse({ cleared: true, hiddenCount: hidden.count });
  } catch (e) {
    return handleApiError(e);
  }
}
