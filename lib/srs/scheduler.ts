/**
 * SM-2 spaced repetition. Grade is SM-2 quality 0–5; the UI maps
 * Again→1, Hard→3, Good→4, Easy→5. Failing (<3) resets reps and re-queues soon.
 * FSRS is a post-MVP upgrade (see post-mvp-backlog).
 */
import type { SrsState } from '@prisma/client';

export type Grade = 0 | 1 | 2 | 3 | 4 | 5;
const DAY_MS = 86_400_000;

export interface SrsCardState {
  easeFactor: number;
  intervalDays: number;
  repetitions: number;
  lapses: number;
  state: SrsState;
}

export interface SrsScheduleResult extends SrsCardState {
  dueAt: Date;
}

export function schedule(card: SrsCardState, grade: Grade, now: Date = new Date()): SrsScheduleResult {
  let { easeFactor, intervalDays, repetitions, lapses } = card;

  if (grade < 3) {
    const wasReview = card.state === 'REVIEW';
    repetitions = 0;
    intervalDays = 0;
    if (wasReview) lapses += 1;
    easeFactor = Math.max(1.3, easeFactor - 0.2);
    // re-queue in ~10 minutes
    return {
      easeFactor,
      intervalDays,
      repetitions,
      lapses,
      state: 'LAPSED',
      dueAt: new Date(now.getTime() + 10 * 60_000),
    };
  }

  repetitions += 1;
  if (repetitions === 1) intervalDays = 1;
  else if (repetitions === 2) intervalDays = 6;
  else intervalDays = Math.max(1, Math.round(intervalDays * easeFactor));

  easeFactor = Math.max(1.3, easeFactor + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02)));

  return {
    easeFactor,
    intervalDays,
    repetitions,
    lapses,
    state: 'REVIEW',
    dueAt: new Date(now.getTime() + intervalDays * DAY_MS),
  };
}
