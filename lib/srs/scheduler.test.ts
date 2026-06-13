import { describe, expect, it } from 'vitest';
import { schedule, type SrsCardState } from './scheduler';

const now = new Date('2026-06-13T00:00:00Z');
const newCard: SrsCardState = {
  state: 'NEW',
  stability: null,
  difficulty: null,
  intervalDays: 0,
  repetitions: 0,
  lapses: 0,
  learningSteps: 0,
  dueAt: now,
  lastReviewedAt: null,
};

describe('FSRS scheduler', () => {
  it('a new card graded Good gets a DSR memory state and a future due date', () => {
    const r = schedule(newCard, 4, 0.9, now);
    expect(r.stability).toBeGreaterThan(0);
    expect(r.difficulty).toBeGreaterThan(0);
    expect(r.repetitions).toBe(1);
    expect(r.dueAt.getTime()).toBeGreaterThan(now.getTime());
  });

  it('Easy schedules farther out than Again', () => {
    const easy = schedule(newCard, 5, 0.9, now);
    const again = schedule(newCard, 1, 0.9, now);
    expect(easy.dueAt.getTime()).toBeGreaterThan(again.dueAt.getTime());
  });

  it('a lapse lowers stability MODERATELY (residual memory), not a reset to 0 (acceptance #6)', () => {
    const mature: SrsCardState = {
      state: 'REVIEW',
      stability: 50,
      difficulty: 5,
      intervalDays: 50,
      repetitions: 5,
      lapses: 0,
      learningSteps: 0,
      dueAt: now,
      lastReviewedAt: new Date('2026-04-24T00:00:00Z'), // ~50d earlier
    };
    const r = schedule(mature, 1, 0.9, now); // Again
    expect(r.lapses).toBe(1);
    expect(r.state).toBe('LAPSED');
    expect(r.stability).toBeGreaterThan(0); // not wiped
    expect(r.stability).toBeLessThan(50); // but reduced
  });

  it('lower desired retention allows longer intervals', () => {
    const card: SrsCardState = {
      state: 'REVIEW',
      stability: 10,
      difficulty: 5,
      intervalDays: 10,
      repetitions: 3,
      lapses: 0,
      learningSteps: 0,
      dueAt: now,
      lastReviewedAt: new Date('2026-06-03T00:00:00Z'),
    };
    const hi = schedule(card, 4, 0.95, now); // want 95% recall → sooner
    const lo = schedule(card, 4, 0.85, now); // want 85% → can wait longer
    expect(lo.intervalDays).toBeGreaterThanOrEqual(hi.intervalDays);
  });
});
