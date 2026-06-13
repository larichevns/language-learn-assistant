/**
 * An exercise/chat error on a word should pull its SRS card earlier so the
 * mistake is reviewed soon — WITHOUT overwriting the scheduler's interval/ease
 * state (the review path owns scheduling). It only advances `dueAt`.
 * See vault/specs/phase-5-implementation-plan.md §3.4.
 */
import type { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;
const DAY_MS = 86_400_000;

export async function nudgeCardEarlier(
  tx: Tx,
  userId: string,
  vocabEntryId: string,
  now: Date = new Date(),
): Promise<boolean> {
  const soon = new Date(now.getTime() + DAY_MS);
  // Pull every (per-direction) card of this word that's due far out — not just one.
  const res = await tx.srsCard.updateMany({
    where: { userId, vocabEntryId, state: { not: 'SUSPENDED' }, dueAt: { gt: soon } },
    data: { dueAt: soon },
  });
  return res.count > 0;
}
