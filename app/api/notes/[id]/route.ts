import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { ApiError, handleApiError, successResponse } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/client';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const row = await prisma.classNote.findFirst({ where: { id, userId: user.userId } });
    if (!row) throw new ApiError('not_found', 'Note not found', 404);
    return successResponse(row);
  } catch (e) {
    return handleApiError(e);
  }
}

const PatchBody = z.object({
  title: z.string().max(200).nullish(),
  rawInput: z.string().min(1).max(20_000).optional(),
  lessonDate: z.string().datetime().nullish(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const parsed = PatchBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return handleApiError(new ApiError('invalid_input', 'Invalid update', 400));
    const d = parsed.data;
    const res = await prisma.classNote.updateMany({
      where: { id, userId: user.userId },
      data: {
        title: d.title ?? undefined,
        rawInput: d.rawInput ?? undefined,
        lessonDate: d.lessonDate ? new Date(d.lessonDate) : undefined,
      },
    });
    if (!res.count) throw new ApiError('not_found', 'Note not found', 404);
    return successResponse(await prisma.classNote.findUnique({ where: { id } }));
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const res = await prisma.classNote.deleteMany({ where: { id, userId: user.userId } });
    if (!res.count) throw new ApiError('not_found', 'Note not found', 404);
    return successResponse({ id, deleted: true });
  } catch (e) {
    return handleApiError(e);
  }
}
