import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { ApiError, handleApiError, successResponse } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/client';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const row = await prisma.homework.findFirst({ where: { id, userId: user.userId } });
    if (!row) throw new ApiError('not_found', 'Homework not found', 404);
    return successResponse(row);
  } catch (e) {
    return handleApiError(e);
  }
}

// Deliberately narrow: only title/entryDate. The correction lifecycle
// (status/rawInput/structuredJson) stays sealed from this generic PATCH.
const PatchBody = z.object({
  title: z.string().max(200).nullish(),
  entryDate: z.string().datetime().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const parsed = PatchBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return handleApiError(new ApiError('invalid_input', 'Invalid update', 400));
    const d = parsed.data;

    const res = await prisma.homework.updateMany({
      where: { id, userId: user.userId },
      data: {
        title: d.title === undefined ? undefined : d.title,
        entryDate: d.entryDate ? new Date(d.entryDate) : undefined,
      },
    });
    if (!res.count) throw new ApiError('not_found', 'Homework not found', 404);
    return successResponse(await prisma.homework.findUnique({ where: { id } }));
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const res = await prisma.homework.deleteMany({ where: { id, userId: user.userId } });
    if (!res.count) throw new ApiError('not_found', 'Homework not found', 404);
    return successResponse({ id, deleted: true });
  } catch (e) {
    return handleApiError(e);
  }
}
