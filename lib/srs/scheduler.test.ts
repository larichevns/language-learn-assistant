import { describe, expect, it } from 'vitest';
import { schedule, type SrsCardState } from './scheduler';

const base: SrsCardState = { easeFactor: 2.5, intervalDays: 0, repetitions: 0, lapses: 0, state: 'NEW' };
const now = new Date('2026-06-13T00:00:00Z');

describe('SM-2 schedule', () => {
  it('first Good → 1 day', () => {
    const r = schedule(base, 4, now);
    expect(r.intervalDays).toBe(1);
    expect(r.repetitions).toBe(1);
    expect(r.state).toBe('REVIEW');
  });

  it('second Good → 6 days', () => {
    const r = schedule({ ...base, repetitions: 1, intervalDays: 1 }, 4, now);
    expect(r.intervalDays).toBe(6);
  });

  it('Again on a review card → lapse, requeue within the hour', () => {
    const r = schedule({ ...base, state: 'REVIEW', repetitions: 5, intervalDays: 30 }, 1, now);
    expect(r.state).toBe('LAPSED');
    expect(r.repetitions).toBe(0);
    expect(r.lapses).toBe(1);
    expect(r.dueAt.getTime() - now.getTime()).toBeLessThan(3_600_000);
  });

  it('ease factor never drops below 1.3', () => {
    let card: SrsCardState = { ...base, state: 'REVIEW' };
    for (let i = 0; i < 10; i++) card = schedule(card, 0, now);
    expect(card.easeFactor).toBeGreaterThanOrEqual(1.3);
  });
});
