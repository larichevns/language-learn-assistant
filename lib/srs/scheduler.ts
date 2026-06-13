/**
 * FSRS scheduler (Slice 5) — the DSR model (Difficulty / Stability /
 * Retrievability) predicts P(recall) and schedules toward a desired retention.
 * Backed by `ts-fsrs` (benchmark-validated, the Anki-ecosystem algorithm).
 *
 * On a lapse FSRS lowers stability *moderately* (residual memory) instead of the
 * SM-2 brutal reset to interval 0 — that's the headline improvement.
 * The append-only `Review` log holds the raw history, so per-user parameter
 * optimization is a later, data-driven step; here we use global defaults.
 * See vault/specs/phase-5-implementation-plan.md §5.1.
 */
import type { SrsState } from '@prisma/client';
import { type Card, createEmptyCard, fsrs, type Grade as FsrsGrade, generatorParameters, Rating, State } from 'ts-fsrs';

export type Grade = 0 | 1 | 2 | 3 | 4 | 5;

export interface SrsCardState {
  state: SrsState;
  stability: number | null;
  difficulty: number | null;
  intervalDays: number;
  repetitions: number;
  lapses: number;
  learningSteps: number;
  dueAt: Date;
  lastReviewedAt: Date | null;
}

export interface SrsScheduleResult {
  state: SrsState;
  stability: number;
  difficulty: number;
  intervalDays: number;
  repetitions: number;
  lapses: number;
  learningSteps: number;
  dueAt: Date;
}

/** UI grade (0–5; Again=1/Hard=3/Good=4/Easy=5) → FSRS Rating (never Manual). */
function toRating(grade: Grade): FsrsGrade {
  if (grade <= 1) return Rating.Again;
  if (grade <= 3) return Rating.Hard;
  if (grade === 4) return Rating.Good;
  return Rating.Easy;
}

const STATE_TO_FSRS: Record<SrsState, State> = {
  NEW: State.New,
  LEARNING: State.Learning,
  REVIEW: State.Review,
  LAPSED: State.Relearning,
  SUSPENDED: State.Review,
};
function fromFsrsState(s: State): SrsState {
  switch (s) {
    case State.New:
      return 'NEW';
    case State.Learning:
      return 'LEARNING';
    case State.Relearning:
      return 'LAPSED';
    default:
      return 'REVIEW';
  }
}

export function schedule(
  card: SrsCardState,
  grade: Grade,
  desiredRetention = 0.9,
  now: Date = new Date(),
): SrsScheduleResult {
  const f = fsrs(generatorParameters({ request_retention: desiredRetention }));

  // Reconstruct the FSRS card from stored state; cards with no FSRS state yet
  // (pre-FSRS / brand new) start fresh and acquire DSR state on this review.
  const base: Card =
    card.stability != null && card.difficulty != null
      ? {
          due: card.dueAt,
          stability: card.stability,
          difficulty: card.difficulty,
          elapsed_days: 0, // recomputed by ts-fsrs from last_review + now
          scheduled_days: card.intervalDays,
          reps: card.repetitions,
          lapses: card.lapses,
          learning_steps: card.learningSteps,
          state: STATE_TO_FSRS[card.state],
          last_review: card.lastReviewedAt ?? undefined,
        }
      : createEmptyCard(now);

  const { card: next } = f.next(base, now, toRating(grade));

  return {
    state: fromFsrsState(next.state),
    stability: next.stability,
    difficulty: next.difficulty,
    intervalDays: next.scheduled_days,
    repetitions: next.reps,
    lapses: next.lapses,
    learningSteps: next.learning_steps,
    dueAt: next.due,
  };
}
