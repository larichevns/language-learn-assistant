import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { ApiError, handleApiError, successResponse } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/client';
import { recordAttempt } from '@/lib/learning/record-attempt';
import { type Grade, schedule } from '@/lib/srs/scheduler';

// GET — due grammar cards for a production-review session.
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') ?? 20) || 20));
    const cards = await prisma.grammarCard.findMany({
      where: { userId: user.userId, dueAt: { lte: new Date() }, state: { not: 'SUSPENDED' } },
      orderBy: { dueAt: 'asc' },
      take: limit,
      include: {
        grammarTopic: {
          select: {
            id: true,
            title: true,
            category: true,
            cefrLevel: true,
            explanationRu: true,
            examplesJson: true,
            pitfallsJson: true,
          },
        },
      },
    });
    return successResponse({ items: cards, count: cards.length });
  } catch (e) {
    return handleApiError(e);
  }
}

const Body = z.object({
  grammarTopicId: z.string(),
  grade: z.number().int().min(0).max(5),
  durationMs: z.number().int().nonnegative().optional(),
});

// POST — self-grade a grammar card; FSRS reschedules + the grade feeds BKT mastery.
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return handleApiError(new ApiError('invalid_input', 'Invalid review', 400));
    const { grammarTopicId, grade, durationMs } = parsed.data;

    const topic = await prisma.grammarTopic.findFirst({
      where: { id: grammarTopicId, userId: user.userId },
      select: { id: true, category: true },
    });
    if (!topic) throw new ApiError('not_found', 'Grammar topic not found', 404);

    const profile = await prisma.learnerProfile.findUnique({
      where: { userId: user.userId },
      select: { desiredRetention: true },
    });
    const now = new Date();

    const card =
      (await prisma.grammarCard.findUnique({ where: { grammarTopicId } })) ??
      (await prisma.grammarCard.create({ data: { userId: user.userId, grammarTopicId } }));

    const result = schedule(
      {
        state: card.state,
        stability: card.stability,
        difficulty: card.difficulty,
        intervalDays: card.intervalDays,
        repetitions: card.repetitions,
        lapses: card.lapses,
        learningSteps: card.learningSteps,
        dueAt: card.dueAt,
        lastReviewedAt: card.lastReviewedAt,
      },
      grade as Grade,
      profile?.desiredRetention ?? 0.9,
      now,
    );

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.grammarCard.update({
        where: { id: card.id },
        data: {
          state: result.state,
          stability: result.stability,
          difficulty: result.difficulty,
          intervalDays: result.intervalDays,
          repetitions: result.repetitions,
          lapses: result.lapses,
          learningSteps: result.learningSteps,
          dueAt: result.dueAt,
          lastReviewedAt: now,
        },
      });
      // Close the loop: a grammar review also feeds BKT mastery + metrics.
      await recordAttempt(tx, {
        userId: user.userId,
        source: 'SRS_REVIEW',
        targetId: card.id,
        grammarTopicId: topic.id,
        category: topic.category,
        isCorrect: grade >= 3,
        grade,
        durationMs: durationMs ?? null,
      });
      return u;
    });

    return successResponse(updated);
  } catch (e) {
    return handleApiError(e);
  }
}
