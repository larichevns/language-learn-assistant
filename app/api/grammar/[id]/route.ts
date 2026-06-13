import { type CefrLevel, Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';
import { ApiError, handleApiError, successResponse } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/client';
import { GrammarTopicPayload } from '@/lib/ai/propose/tool';

const json = (v: unknown): Prisma.InputJsonValue | undefined =>
  v == null ? undefined : (v as Prisma.InputJsonValue);

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
    const parsed = GrammarTopicPayload.partial().safeParse(await req.json().catch(() => null));
    if (!parsed.success) return handleApiError(new ApiError('invalid_input', 'Invalid update', 400));
    const g = parsed.data;
    const res = await prisma.grammarTopic.updateMany({
      where: { id, userId: user.userId },
      data: {
        title: g.title ?? undefined,
        cefrLevel: (g.cefrLevel ?? undefined) as CefrLevel | undefined,
        explanationRu: g.explanationRu ?? undefined,
        examplesJson: json(g.examples),
        rulesJson: json(g.rules),
        pitfallsJson: json(g.pitfalls),
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
