/**
 * recordAttempt — the single funnel every gradeable event flows through
 * (exercise grading, SRS review, homework correction). Appends an immutable
 * `Attempt` and updates BKT mastery on the resolved grammar topic. Runs INSIDE
 * the caller's transaction.
 *
 * It deliberately does NOT schedule SRS: scheduling is owned by whoever holds
 * the card (the review path schedules; exercise errors nudge — see nudge.ts).
 * This keeps responsibilities clean and avoids double-shifting `dueAt`.
 * See vault/specs/phase-5-implementation-plan.md §3.
 */
import type { AttemptSource, GrammarCategory, Prisma, ReviewDirection } from '@prisma/client';
import { bktUpdate } from './bkt';

type Tx = Prisma.TransactionClient;

export interface AttemptInput {
  userId: string;
  source: AttemptSource;
  targetId: string;
  vocabEntryId?: string | null;
  grammarTopicId?: string | null;
  category?: GrammarCategory | null;
  direction?: ReviewDirection | null;
  isCorrect: boolean;
  grade?: number | null;
  errorTypeJson?: unknown;
  durationMs?: number | null;
}

export interface AttemptResult {
  attemptId: string;
  masteryBefore?: number;
  masteryAfter?: number;
}

export async function recordAttempt(tx: Tx, e: AttemptInput): Promise<AttemptResult> {
  const attempt = await tx.attempt.create({
    data: {
      userId: e.userId,
      source: e.source,
      targetId: e.targetId,
      vocabEntryId: e.vocabEntryId ?? null,
      grammarTopicId: e.grammarTopicId ?? null,
      category: e.category ?? null,
      direction: e.direction ?? null,
      isCorrect: e.isCorrect,
      grade: e.grade ?? null,
      errorTypeJson: (e.errorTypeJson ?? undefined) as Prisma.InputJsonValue | undefined,
      durationMs: e.durationMs ?? null,
    },
    select: { id: true },
  });

  let masteryBefore: number | undefined;
  let masteryAfter: number | undefined;

  // BKT only moves when the attempt is tied to a skill (owned by this user).
  if (e.grammarTopicId) {
    const topic = await tx.grammarTopic.findFirst({
      where: { id: e.grammarTopicId, userId: e.userId },
      select: { masteryScore: true },
    });
    if (topic) {
      masteryBefore = topic.masteryScore;
      masteryAfter = bktUpdate(topic.masteryScore, e.isCorrect);
      await tx.grammarTopic.update({
        where: { id: e.grammarTopicId },
        data: { masteryScore: masteryAfter, masteryUpdatedAt: new Date() },
      });
    }
  }

  return { attemptId: attempt.id, masteryBefore, masteryAfter };
}
