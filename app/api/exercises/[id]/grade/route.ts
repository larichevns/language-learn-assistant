import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { ApiError, handleApiError, successResponse } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/client';

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
      include: { items: true },
    });
    if (!set) throw new ApiError('not_found', 'Exercise set not found', 404);

    const byId = new Map(set.items.map((it) => [it.id, it]));
    let correctCount = 0;

    const updates = parsed.data.answers
      .filter((a) => byId.has(a.itemId))
      .map((a) => {
        const item = byId.get(a.itemId)!;
        const acceptable = [item.answer, ...((item.acceptableAnswersJson as string[] | null) ?? [])].map(normalize);
        const isCorrect = acceptable.includes(normalize(a.userAnswer));
        if (isCorrect) correctCount += 1;
        return prisma.exerciseItem.update({
          where: { id: item.id },
          data: { userAnswer: a.userAnswer, isCorrect, answeredAt: new Date() },
        });
      });

    const score = set.items.length ? correctCount / set.items.length : 0;
    await prisma.$transaction([
      ...updates,
      prisma.exerciseSet.update({ where: { id }, data: { status: 'GRADED', score } }),
    ]);

    const graded = await prisma.exerciseSet.findUnique({
      where: { id },
      include: { items: { orderBy: { orderIndex: 'asc' } } },
    });
    return successResponse({ score, correct: correctCount, total: set.items.length, set: graded });
  } catch (e) {
    return handleApiError(e);
  }
}
