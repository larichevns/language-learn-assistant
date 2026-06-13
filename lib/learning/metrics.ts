/**
 * Progress metrics — ALL derived from immutable logs (Review / Attempt /
 * SrsCard / VocabEntry), never from authored numbers. Daily data is noisy, so
 * the UI frames these as trends, not single-day truth.
 * See vault/specs/phase-5-implementation-plan.md §6.2.
 */
import { prisma } from '../db/client';

const DAY_MS = 86_400_000;
/** Gradeable attempt sources (homework attempts are always errors → excluded from accuracy). */
const GRADEABLE = ['EXERCISE_ITEM', 'SRS_REVIEW', 'CHAT_DRILL'] as const;

export interface ProgressStats {
  trueRetention: number | null; // pass-rate (grade≥3) of reviews on cards with interval≥1d
  retentionSample: number;
  mature: number; // SrsCard intervalDays ≥ 21
  young: number; // active cards with interval < 21
  totalCards: number;
  reviews30: number;
  gradeable30: number;
  accuracy30: number | null; // share of correct gradeable attempts (30d)
  streakDays: number;
  wordsByCefr: Array<{ cefr: string; count: number }>;
  errorsByCategory: Array<{ category: string; count: number }>;
}

/** Pure: longest run of consecutive UTC days with activity, ending today or yesterday. */
export function computeStreak(dates: Date[], now: Date = new Date()): number {
  if (!dates.length) return 0;
  const dayIdx = (d: Date) => Math.floor(d.getTime() / DAY_MS);
  const days = new Set(dates.map(dayIdx));
  const today = dayIdx(now);
  const start = days.has(today) ? today : days.has(today - 1) ? today - 1 : null;
  if (start === null) return 0;
  let streak = 0;
  for (let d = start; days.has(d); d--) streak += 1;
  return streak;
}

export async function computeProgressStats(userId: string, now: Date = new Date()): Promise<ProgressStats> {
  const since30 = new Date(now.getTime() - 30 * DAY_MS);
  const own = { srsCard: { userId } };

  const [
    retPass,
    retTotal,
    mature,
    young,
    totalCards,
    reviews30,
    gradeable30,
    gradeableCorrect30,
    wordsByCefrRaw,
    errorsRaw,
    recentReviewDays,
    recentAttemptDays,
  ] = await Promise.all([
    prisma.review.count({ where: { ...own, prevInterval: { gte: 1 }, grade: { gte: 3 } } }),
    prisma.review.count({ where: { ...own, prevInterval: { gte: 1 } } }),
    prisma.srsCard.count({ where: { userId, intervalDays: { gte: 21 } } }),
    prisma.srsCard.count({ where: { userId, intervalDays: { lt: 21 }, state: { in: ['LEARNING', 'REVIEW', 'LAPSED'] } } }),
    prisma.srsCard.count({ where: { userId } }),
    prisma.review.count({ where: { ...own, reviewedAt: { gte: since30 } } }),
    prisma.attempt.count({ where: { userId, attemptedAt: { gte: since30 }, source: { in: [...GRADEABLE] } } }),
    prisma.attempt.count({ where: { userId, attemptedAt: { gte: since30 }, source: { in: [...GRADEABLE] }, isCorrect: true } }),
    prisma.vocabEntry.groupBy({ by: ['cefrLevel'], where: { userId }, _count: true }),
    prisma.attempt.groupBy({ by: ['category'], where: { userId, isCorrect: false, attemptedAt: { gte: since30 } }, _count: true }),
    prisma.review.findMany({ where: own, orderBy: { reviewedAt: 'desc' }, take: 300, select: { reviewedAt: true } }),
    prisma.attempt.findMany({ where: { userId }, orderBy: { attemptedAt: 'desc' }, take: 300, select: { attemptedAt: true } }),
  ]);

  const cefrOrder = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', '—'];
  const wordsByCefr = wordsByCefrRaw
    .map((r) => ({ cefr: r.cefrLevel ?? '—', count: r._count }))
    .sort((a, b) => cefrOrder.indexOf(a.cefr) - cefrOrder.indexOf(b.cefr));

  const errorsByCategory = errorsRaw
    .filter((r) => r.category)
    .map((r) => ({ category: String(r.category), count: r._count }))
    .sort((a, b) => b.count - a.count);

  const streakDays = computeStreak(
    [...recentReviewDays.map((r) => r.reviewedAt), ...recentAttemptDays.map((a) => a.attemptedAt)],
    now,
  );

  return {
    trueRetention: retTotal ? retPass / retTotal : null,
    retentionSample: retTotal,
    mature,
    young,
    totalCards,
    reviews30,
    gradeable30,
    accuracy30: gradeable30 ? gradeableCorrect30 / gradeable30 : null,
    streakDays,
    wordsByCefr,
    errorsByCategory,
  };
}
