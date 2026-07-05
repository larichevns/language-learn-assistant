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
  entryDate: z.string().datetime().optional(),
});

// `groupId` is parsed separately so we can tell "absent" (leave unchanged) from
// `null` (move to ungrouped). Same tri-state pattern as vocab/grammar [id].
const MoveGroup = z.object({ groupId: z.string().nullable().optional() });

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = await req.json().catch(() => null);
    const parsed = PatchBody.safeParse(body);
    if (!parsed.success) return handleApiError(new ApiError('invalid_input', 'Invalid update', 400));
    const d = parsed.data;

    const move = MoveGroup.safeParse(body);
    if (!move.success) return handleApiError(new ApiError('invalid_input', 'Invalid update', 400));
    const groupIdProvided = move.data.groupId !== undefined;
    const nextGroupId = move.data.groupId ?? null;
    // Validate a non-null target group belongs to the user AND is a NOTE group.
    if (groupIdProvided && nextGroupId !== null) {
      const grp = await prisma.collectionGroup.findFirst({
        where: { id: nextGroupId, userId: user.userId, domain: 'NOTE' },
        select: { id: true },
      });
      if (!grp) throw new ApiError('invalid_input', 'Group not found', 422);
    }

    const res = await prisma.classNote.updateMany({
      where: { id, userId: user.userId },
      data: {
        title: d.title === undefined ? undefined : d.title,
        rawInput: d.rawInput ?? undefined,
        lessonDate: d.lessonDate ? new Date(d.lessonDate) : undefined,
        entryDate: d.entryDate ? new Date(d.entryDate) : undefined,
        groupId: groupIdProvided ? nextGroupId : undefined,
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
