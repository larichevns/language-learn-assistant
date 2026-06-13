import type { NextRequest } from 'next/server';
import { ApiError, handleApiError, successResponse } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/client';

/** Refine doesn't mutate the target — it supersedes the card and returns its
 *  payload so the client can prefill the dock and re-run the feature. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const proposal = await prisma.proposal.findFirst({ where: { id, userId: user.userId } });
    if (!proposal) throw new ApiError('not_found', 'Proposal not found', 404);
    if (proposal.status !== 'PENDING') throw new ApiError('conflict', `Already ${proposal.status.toLowerCase()}`, 409);

    await prisma.proposal.update({ where: { id }, data: { status: 'SUPERSEDED' } });
    return successResponse({
      id,
      status: 'SUPERSEDED',
      targetType: proposal.targetType,
      op: proposal.op,
      summary: proposal.summary,
      payload: proposal.payloadJson,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
