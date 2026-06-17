import { type CefrLevel, Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { ApiError, handleApiError, successResponse } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/client';
import { GrammarTopicFields } from '@/lib/ai/propose/tool';

const json = (v: unknown): Prisma.InputJsonValue | undefined =>
  v == null ? undefined : (v as Prisma.InputJsonValue);

// `groupId` is parsed from the raw body separately so we can tell "absent"
// (leave unchanged) from `null` (move to ungrouped) — `.partial()` over a
// nullish field can't preserve that distinction. Same pattern as vocab [id].
const MoveGroup = z.object({ groupId: z.string().nullable().optional() });

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const row = await prisma.grammarTopic.findFirst({ where: { id, userId: user.userId } });
    if (!row) throw new ApiError('not_found', 'Grammar topic not found', 404);
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
    const parsed = GrammarTopicFields.partial().safeParse(body);
    if (!parsed.success) return handleApiError(new ApiError('invalid_input', 'Invalid update', 400));
    const g = parsed.data;

    const move = MoveGroup.safeParse(body);
    if (!move.success) return handleApiError(new ApiError('invalid_input', 'Invalid update', 400));
    const groupIdProvided = move.data.groupId !== undefined;
    const nextGroupId = move.data.groupId ?? null;
    // Validate a non-null target group belongs to the user AND is a GRAMMAR group.
    if (groupIdProvided && nextGroupId !== null) {
      const grp = await prisma.collectionGroup.findFirst({
        where: { id: nextGroupId, userId: user.userId, domain: 'GRAMMAR' },
        select: { id: true },
      });
      if (!grp) throw new ApiError('invalid_input', 'Group not found', 422);
    }

    const res = await prisma.grammarTopic.updateMany({
      where: { id, userId: user.userId },
      data: {
        title: g.title ?? undefined,
        cefrLevel: (g.cefrLevel ?? undefined) as CefrLevel | undefined,
        explanationRu: g.explanationRu ?? undefined,
        examplesJson: json(g.examples),
        rulesJson: json(g.rules),
        pitfallsJson: json(g.pitfalls),
        groupId: groupIdProvided ? nextGroupId : undefined,
      },
    });
    if (!res.count) throw new ApiError('not_found', 'Grammar topic not found', 404);
    return successResponse(await prisma.grammarTopic.findUnique({ where: { id } }));
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const res = await prisma.grammarTopic.deleteMany({ where: { id, userId: user.userId } });
    if (!res.count) throw new ApiError('not_found', 'Grammar topic not found', 404);
    return successResponse({ id, deleted: true });
  } catch (e) {
    return handleApiError(e);
  }
}
