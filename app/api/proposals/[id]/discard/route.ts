import type { NextRequest } from 'next/server';
import { ApiError, handleApiError, successResponse } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/client';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const res = await prisma.proposal.updateMany({
      where: { id, userId: user.userId, status: 'PENDING' },
      data: { status: 'DISCARDED' },
    });
    if (!res.count) throw new ApiError('not_found', 'Proposal not found or already resolved', 404);
    return successResponse({ id, status: 'DISCARDED' });
  } catch (e) {
    return handleApiError(e);
  }
}
