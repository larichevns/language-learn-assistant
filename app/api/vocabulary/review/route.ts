import type { ReviewDirection } from '@prisma/client';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { ApiError, handleApiError, successResponse } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/client';
import { type Grade, schedule } from '@/lib/srs/scheduler';

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

    const vocab = await prisma.vocabEntry.findFirst({ where: { id: vocabEntryId, userId: user.userId }, select: { id: true } });
    if (!vocab) throw new ApiError('not_found', 'Vocab entry not found', 404);

    const card =
      (await prisma.srsCard.findUnique({ where: { vocabEntryId } })) ??
      (await prisma.srsCard.create({ data: { userId: user.userId, vocabEntryId } }));

    const result = schedule(
      {
        easeFactor: card.easeFactor,
        intervalDays: card.intervalDays,
        repetitions: card.repetitions,
        lapses: card.lapses,
        state: card.state,
      },
      grade as Grade,
    );

    const [updated] = await prisma.$transaction([
      prisma.srsCard.update({
        where: { id: card.id },
        data: {
          easeFactor: result.easeFactor,
          intervalDays: result.intervalDays,
          repetitions: result.repetitions,
          lapses: result.lapses,
          state: result.state,
          dueAt: result.dueAt,
          lastReviewedAt: new Date(),
        },
      }),
      prisma.review.create({
        data: {
          srsCardId: card.id,
          grade,
          direction: (direction as ReviewDirection) ?? 'DE_TO_RU',
          prevInterval: card.intervalDays,
          newInterval: result.intervalDays,
          prevEase: card.easeFactor,
          newEase: result.easeFactor,
          durationMs,
        },
      }),
    ]);

    return successResponse(updated);
  } catch (e) {
    return handleApiError(e);
  }
}
