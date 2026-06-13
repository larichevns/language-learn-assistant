import { describe, expect, it } from 'vitest';
import { computeStreak } from './metrics';

const DAY = 86_400_000;
const now = new Date('2026-06-13T12:00:00Z');

describe('computeStreak', () => {
  it('counts consecutive days ending today', () => {
    const days = [now, new Date(now.getTime() - DAY), new Date(now.getTime() - 2 * DAY)];
    expect(computeStreak(days, now)).toBe(3);
  });

  it('counts from yesterday when there is nothing today', () => {
    const days = [new Date(now.getTime() - DAY), new Date(now.getTime() - 2 * DAY)];
    expect(computeStreak(days, now)).toBe(2);
  });

  it('breaks on a gap', () => {
    const days = [now, new Date(now.getTime() - 3 * DAY)];
    expect(computeStreak(days, now)).toBe(1);
  });

  it('dedupes multiple events on the same day', () => {
    const days = [now, new Date(now.getTime() - 1000), new Date(now.getTime() - DAY)];
    expect(computeStreak(days, now)).toBe(2);
  });

  it('returns 0 for no activity or stale activity', () => {
    expect(computeStreak([], now)).toBe(0);
    expect(computeStreak([new Date(now.getTime() - 5 * DAY)], now)).toBe(0);
  });
});
