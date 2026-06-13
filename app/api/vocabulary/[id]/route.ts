import { type CefrLevel, Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';
import { ApiError, handleApiError, successResponse } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/client';
import { VocabEntryPayload } from '@/lib/ai/propose/tool';

const json = (v: unknown): Prisma.InputJsonValue | undefined =>
  v == null ? undefined : (v as Prisma.InputJsonValue);

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const row = await prisma.vocabEntry.findFirst({
      where: { id, userId: user.userId },
      include: { srsCard: true },
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
    const parsed = VocabEntryPayload.partial().safeParse(await req.json().catch(() => null));
    if (!parsed.success) return handleApiError(new ApiError('invalid_input', 'Invalid update', 400));
    const v = parsed.data;

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
        notes: undefined,
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
