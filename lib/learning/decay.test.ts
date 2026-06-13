import { describe, expect, it } from 'vitest';
import { decayedMastery, masteryBucket } from './decay';

describe('decay-on-read', () => {
  it('a 90-days-stale 0.85 mastery decays to ~10.6% → bucket «слабое» (acceptance #3)', () => {
    const now = new Date('2026-06-13T00:00:00Z');
    const updated = new Date('2026-03-15T00:00:00Z'); // ~90 days earlier
    const eff = decayedMastery(0.85, updated, now); // 0.85 * 2^(-90/30) ≈ 0.106
    expect(eff).toBeGreaterThan(0.08);
    expect(eff).toBeLessThan(0.16);
    expect(masteryBucket(eff)).toBe('слабое');
  });

  it('fresh mastery is not decayed', () => {
    const now = new Date('2026-06-13T00:00:00Z');
    expect(decayedMastery(0.9, now, now)).toBeCloseTo(0.9, 5);
  });

  it('treats stored<=0 as 0', () => {
    expect(decayedMastery(0, new Date('2026-01-01T00:00:00Z'), new Date('2026-06-13T00:00:00Z'))).toBe(0);
  });

  it('buckets map by threshold', () => {
    expect(masteryBucket(0.9)).toBe('освоено');
    expect(masteryBucket(0.6)).toBe('закрепляется');
    expect(masteryBucket(0.3)).toBe('учится');
    expect(masteryBucket(0.05)).toBe('слабое');
  });
});
