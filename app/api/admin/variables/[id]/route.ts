import type { NextRequest } from 'next/server';
import { ApiError, handleApiError, successResponse } from '@/lib/api/response';
import { requireAdmin } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/client';

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const variable = await prisma.promptVariable.findUnique({ where: { id } });
    if (!variable) throw new ApiError('not_found', 'Variable not found', 404);

    // Block deletion if referenced by an active template's user prompt.
    const token = `{{${variable.key}}}`;
    const refs = await prisma.promptTemplate.findMany({
      where: { isActive: true, userPromptTemplate: { contains: token } },
      select: { id: true, featureId: true },
    });
    if (refs.length) {
      throw new ApiError('conflict', `Variable referenced by ${refs.length} active template(s)`, 409);
    }
    await prisma.promptVariable.delete({ where: { id } });
    return successResponse({ id, deleted: true });
  } catch (e) {
    return handleApiError(e);
  }
}
