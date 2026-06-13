import type { NextRequest } from 'next/server';
import { handleApiError, successResponse } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/guards';
import { applyProposalDb } from '@/lib/ai/propose/apply-db';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const result = await applyProposalDb(id, user.userId);
    return successResponse(result);
  } catch (e) {
    return handleApiError(e);
  }
}
