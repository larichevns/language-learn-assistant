import type { ReviewDirection } from '@prisma/client';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { ApiError, handleApiError, successResponse } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/client';
import { type Grade, schedule } from '@/lib/srs/scheduler';
import { recordAttempt } from '@/lib/learning/record-attempt';
import { emitTimelineEvent } from '@/lib/learning/timeline';

// GET — the due-card queue for a review session.
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const limit = Math.min(50, Math.max(1, Number(url.searchParams.get('limit') ?? 20) || 20));
    const cards = await prisma.srsCard.findMany({
      where: { userId: user.userId, dueAt: { lte: new Date() }, state: { not: 'SUSPENDED' } },
      orderBy: { dueAt: 'asc' },
      take: limit,
      include: { vocabEntry: true },
    });
    return successResponse({ items: cards, count: cards.length });
  } catch (e) {
    return handleApiError(e);
  }
}

const ReviewBody = z.object({
  vocabEntryId: z.string(),
  grade: z.number().int().min(0).max(5),
  direction: z.enum(['DE_TO_RU', 'RU_TO_DE', 'PRODUCE_ARTICLE', 'PRODUCE_PLURAL']).optional(),
  durationMs: z.number().int().nonnegative().optional(),
});

// POST — grade a card; reschedules via SM-2 and records the review.
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const parsed = ReviewBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return handleApiError(new ApiError('invalid_input', 'Invalid review', 400));
    const { vocabEntryId, grade, direction, durationMs } = parsed.data;

    const vocab = await prisma.vocabEntry.findFirst({ where: { id: vocabEntryId, userId: user.userId }, select: { id: true, lemma: true } });
    if (!vocab) throw new ApiError('not_found', 'Vocab entry not found', 404);

    const profile = await prisma.learnerProfile.findUnique({
      where: { userId: user.userId },
      select: { desiredRetention: true },
    });
    const now = new Date();

    const dir = (direction as ReviewDirection) ?? 'DE_TO_RU';
    const card =
      (await prisma.srsCard.findUnique({ where: { vocabEntryId_direction: { vocabEntryId, direction: dir } } })) ??
      (await prisma.srsCard.create({ data: { userId: user.userId, vocabEntryId, direction: dir } }));

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
      const u = await tx.srsCard.update({
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
      await tx.review.create({
        data: {
          srsCardId: card.id,
          grade,
          direction: dir,
          prevInterval: card.intervalDays,
          newInterval: result.intervalDays,
          // FSRS has no SM-2 "ease"; store difficulty (its analog) in the revlog.
          prevEase: card.difficulty ?? card.easeFactor,
          newEase: result.difficulty,
          durationMs,
        },
      });
      // Close the loop: append an immutable Attempt (volume/speed metrics; BKT
      // when the card maps to a skill). The scheduler above owns rescheduling.
      await recordAttempt(tx, {
        userId: user.userId,
        source: 'SRS_REVIEW',
        targetId: card.id,
        vocabEntryId,
        direction: (direction as ReviewDirection) ?? 'DE_TO_RU',
        isCorrect: grade >= 3,
        grade,
        durationMs: durationMs ?? null,
      });
      // Milestone: a card crossing into "mature" (≥21d) lands on the timeline.
      if (result.intervalDays >= 21 && card.intervalDays < 21) {
        await emitTimelineEvent(tx, {
          userId: user.userId,
          type: 'CARD_MATURED',
          refType: 'SRS_CARD',
          refId: card.id,
          payload: { lemma: vocab.lemma, intervalDays: result.intervalDays },
        });
      }
      return u;
    });

    return successResponse(updated);
  } catch (e) {
    return handleApiError(e);
  }
}
