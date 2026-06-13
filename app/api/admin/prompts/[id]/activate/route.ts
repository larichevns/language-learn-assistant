import type { NextRequest } from 'next/server';
import { ApiError, handleApiError, successResponse } from '@/lib/api/response';
import { requireAdmin } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/client';

/** Activate this template version; atomically deactivate other versions of the
 *  same (featureId, promptType). */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const t = await prisma.promptTemplate.findUnique({ where: { id } });
    if (!t) throw new ApiError('not_found', 'Template not found', 404);

    await prisma.$transaction([
      prisma.promptTemplate.updateMany({
        where: { featureId: t.featureId, promptType: t.promptType, NOT: { id } },
        data: { isActive: false },
      }),
      prisma.promptTemplate.update({ where: { id }, data: { isActive: true } }),
    ]);
    return successResponse({ id, isActive: true });
  } catch (e) {
    return handleApiError(e);
  }
}
