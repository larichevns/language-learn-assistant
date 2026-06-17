import { type CefrLevel, Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { ApiError, handleApiError, successResponse } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/client';
import { VocabEntryPayload } from '@/lib/ai/propose/tool';

// `groupId` is parsed from the raw body separately so we can tell "absent"
// (leave unchanged) from `null` (move to ungrouped) — `.partial()` over a
// nullish field can't preserve that distinction.
const MoveGroup = z.object({ groupId: z.string().nullable().optional() });

const json = (v: unknown): Prisma.InputJsonValue | undefined =>
  v == null ? undefined : (v as Prisma.InputJsonValue);

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const row = await prisma.vocabEntry.findFirst({
      where: { id, userId: user.userId },
      include: { srsCards: true },
    });
    if (!row) throw new ApiError('not_found', 'Vocab entry not found', 404);
    return successResponse(row);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = await req.json().catch(() => null);
    const parsed = VocabEntryPayload.partial().safeParse(body);
    if (!parsed.success) return handleApiError(new ApiError('invalid_input', 'Invalid update', 400));
    const v = parsed.data;

    const move = MoveGroup.safeParse(body);
    if (!move.success) return handleApiError(new ApiError('invalid_input', 'Invalid update', 400));
    const groupIdProvided = move.data.groupId !== undefined;
    const nextGroupId = move.data.groupId ?? null;
    // Validate a non-null target group belongs to the user before assigning it.
    if (groupIdProvided && nextGroupId !== null) {
      const grp = await prisma.collectionGroup.findFirst({
        where: { id: nextGroupId, userId: user.userId, domain: 'VOCAB' },
        select: { id: true },
      });
      if (!grp) throw new ApiError('invalid_input', 'Group not found', 422);
    }

    const res = await prisma.vocabEntry.updateMany({
      where: { id, userId: user.userId },
      data: {
        translationRu: v.translationRu ?? undefined,
        gender: v.gender ?? undefined,
        pluralForm: v.pluralForm ?? undefined,
        genitiveForm: v.genitiveForm ?? undefined,
        auxiliary: v.auxiliary ?? undefined,
        partizipII: v.partizipII ?? undefined,
        praeteritum: v.praeteritum ?? undefined,
        cefrLevel: (v.cefrLevel ?? undefined) as CefrLevel | undefined,
        examplesJson: json(v.examples),
        tagsJson: json(v.tags),
        groupId: groupIdProvided ? nextGroupId : undefined,
      },
    });
    if (!res.count) throw new ApiError('not_found', 'Vocab entry not found', 404);
    const row = await prisma.vocabEntry.findUnique({ where: { id } });
    return successResponse(row);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const res = await prisma.vocabEntry.deleteMany({ where: { id, userId: user.userId } });
    if (!res.count) throw new ApiError('not_found', 'Vocab entry not found', 404);
    return successResponse({ id, deleted: true });
  } catch (e) {
    return handleApiError(e);
  }
}
