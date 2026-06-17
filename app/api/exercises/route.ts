import { type CefrLevel, type ExerciseType, Prisma, type SourceObjectType } from '@prisma/client';
import type { NextRequest } from 'next/server';
import { ApiError, handleApiError, successResponse } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/guards';
import { listResult, parsePagination } from '@/lib/api/pagination';
import { prisma } from '@/lib/db/client';
import { ExerciseSetPayload } from '@/lib/ai/propose/tool';

const json = (v: unknown): Prisma.InputJsonValue | undefined =>
  v == null ? undefined : (v as Prisma.InputJsonValue);

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const p = parsePagination(url);
    const where: Prisma.ExerciseSetWhereInput = { userId: user.userId };
    const [items, total] = await Promise.all([
      prisma.exerciseSet.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: p.skip,
        take: p.take,
        // `include` already returns scalars (grammarTopicId, sourceType); add the
        // linked topic title so the Exercises page can group by topic (§2.4).
        include: { _count: { select: { items: true } }, grammarTopic: { select: { title: true } } },
      }),
      prisma.exerciseSet.count({ where }),
    ]);
    return successResponse(listResult(items, total, p));
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const parsed = ExerciseSetPayload.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return handleApiError(new ApiError('invalid_input', 'Invalid exercise set', 400));
    const e = parsed.data;
    const unit = await prisma.unit.findFirst({ where: { course: { userId: user.userId }, isCurrent: true }, select: { id: true } });
    const row = await prisma.exerciseSet.create({
      data: {
        userId: user.userId,
        unitId: unit?.id ?? null,
        title: e.title,
        sourceType: (e.sourceType ?? 'MANUAL') as SourceObjectType,
        cefrLevel: (e.cefrLevel ?? null) as CefrLevel | null,
        status: 'GENERATED',
        items: {
          create: e.items.map((it, i) => ({
            type: it.type as ExerciseType,
            orderIndex: i,
            prompt: it.prompt,
            promptMetaJson: json(it.promptMeta),
            optionsJson: json(it.options),
            answer: it.answer,
            acceptableAnswersJson: json(it.acceptableAnswers),
            feedbackRu: it.explanationRu ?? null,
          })),
        },
      },
      include: { items: { orderBy: { orderIndex: 'asc' } } },
    });
    return successResponse(row, 201);
  } catch (e) {
    return handleApiError(e);
  }
}
