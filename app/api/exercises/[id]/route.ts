import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { ApiError, handleApiError, successResponse } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/client';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const row = await prisma.exerciseSet.findFirst({
      where: { id, userId: user.userId },
      include: { items: { orderBy: { orderIndex: 'asc' } } },
    });
    if (!row) throw new ApiError('not_found', 'Exercise set not found', 404);
    return successResponse(row);
  } catch (e) {
    return handleApiError(e);
  }
}

const PatchBody = z.object({
  entryDate: z.string().datetime().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const parsed = PatchBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return handleApiError(new ApiError('invalid_input', 'Invalid update', 400));
    const d = parsed.data;

    const res = await prisma.exerciseSet.updateMany({
      where: { id, userId: user.userId },
      data: {
        entryDate: d.entryDate ? new Date(d.entryDate) : undefined,
      },
    });
    if (!res.count) throw new ApiError('not_found', 'Exercise set not found', 404);
    return successResponse(await prisma.exerciseSet.findUnique({ where: { id } }));
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const res = await prisma.exerciseSet.deleteMany({ where: { id, userId: user.userId } });
    if (!res.count) throw new ApiError('not_found', 'Exercise set not found', 404);
    return successResponse({ id, deleted: true });
  } catch (e) {
    return handleApiError(e);
  }
}
