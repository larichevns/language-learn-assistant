import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { ApiError, handleApiError, successResponse } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/client';
import { recordAttempt } from '@/lib/learning/record-attempt';
import { nudgeCardEarlier } from '@/lib/learning/nudge';

const Body = z.object({
  answers: z.array(z.object({ itemId: z.string(), userAnswer: z.string() })).min(1),
});

const normalize = (s: string): string =>
  s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.!?,;:]+$/g, '');

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return handleApiError(new ApiError('invalid_input', 'Invalid answers', 400));

    const set = await prisma.exerciseSet.findFirst({
      where: { id, userId: user.userId },
      include: { items: true, grammarTopic: { select: { id: true, category: true } } },
    });
    if (!set) throw new ApiError('not_found', 'Exercise set not found', 404);

    const byId = new Map(set.items.map((it) => [it.id, it]));
    let correctCount = 0;

    const graded = parsed.data.answers
      .filter((a) => byId.has(a.itemId))
      .map((a) => {
        const item = byId.get(a.itemId)!;
        const acceptable = [item.answer, ...((item.acceptableAnswersJson as string[] | null) ?? [])].map(normalize);
        const isCorrect = acceptable.includes(normalize(a.userAnswer));
        if (isCorrect) correctCount += 1;
        return { item, userAnswer: a.userAnswer, isCorrect };
      });

    const score = set.items.length ? correctCount / set.items.length : 0;

    // Grade + close the loop in one transaction: persist the answer, append an
    // immutable Attempt (→ BKT mastery on the set's topic), and pull a wrong
    // word's SRS card earlier so the mistake resurfaces soon.
    await prisma.$transaction(async (tx) => {
      for (const g of graded) {
        await tx.exerciseItem.update({
          where: { id: g.item.id },
          data: { userAnswer: g.userAnswer, isCorrect: g.isCorrect, answeredAt: new Date() },
        });
        await recordAttempt(tx, {
          userId: user.userId,
          source: 'EXERCISE_ITEM',
          targetId: g.item.id,
          vocabEntryId: g.item.vocabEntryId,
          grammarTopicId: set.grammarTopicId,
          category: set.grammarTopic?.category ?? null,
          isCorrect: g.isCorrect,
        });
        if (!g.isCorrect && g.item.vocabEntryId) {
          await nudgeCardEarlier(tx, user.userId, g.item.vocabEntryId);
        }
      }
      await tx.exerciseSet.update({ where: { id }, data: { status: 'GRADED', score } });
    });

    const gradedSet = await prisma.exerciseSet.findUnique({
      where: { id },
      include: { items: { orderBy: { orderIndex: 'asc' } } },
    });
    return successResponse({ score, correct: correctCount, total: set.items.length, set: gradedSet });
  } catch (e) {
    return handleApiError(e);
  }
}
