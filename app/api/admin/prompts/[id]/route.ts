import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { ApiError, handleApiError, successResponse } from '@/lib/api/response';
import { requireAdmin } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/client';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const row = await prisma.promptTemplate.findUnique({ where: { id }, include: { feature: true } });
    if (!row) throw new ApiError('not_found', 'Template not found', 404);
    return successResponse(row);
  } catch (e) {
    return handleApiError(e);
  }
}

const PatchBody = z.object({
  systemPrompt: z.string().optional(),
  userPromptTemplate: z.string().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const parsed = PatchBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return handleApiError(new ApiError('invalid_input', 'Invalid update', 400));
    const row = await prisma.promptTemplate.update({ where: { id }, data: parsed.data });
    return successResponse(row);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    await prisma.promptTemplate.delete({ where: { id } });
    return successResponse({ id, deleted: true });
  } catch (e) {
    return handleApiError(e);
  }
}
