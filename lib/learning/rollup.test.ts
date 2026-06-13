import { describe, expect, it } from 'vitest';
import { cleanNote, computeWeakAreas, diffClearedAreas, pickStreakMilestones } from './rollup';

describe('cleanNote', () => {
  it('strips bold/italic/headings and flattens to one paragraph', () => {
    expect(cleanNote('**Серия:** 1 день, точность *63%*')).toBe('Серия: 1 день, точность 63%');
    expect(cleanNote('# Заголовок\nтекст')).toBe('Заголовок текст');
    expect(cleanNote('__важно__ и обычно')).toBe('важно и обычно');
  });

  it('strips bullet lists and horizontal rules', () => {
    expect(cleanNote('Итог:\n*   серия 1\n*   точность 63%\n---')).toBe('Итог: серия 1 точность 63%');
  });
});

describe('computeWeakAreas', () => {
  it('keeps only below-threshold topics, most-faded first', () => {
    const out = computeWeakAreas({
      topics: [
        { title: 'Perfekt', decayed: 0.12 },
        { title: 'Artikel', decayed: 0.85 }, // mastered → excluded
        { title: 'Kasus', decayed: 0.4 },
      ],
      errorHotspots: [],
    });
    expect(out).toEqual(['Perfekt', 'Kasus']);
  });

  it('adds recurring error categories (≥3) as RU labels, drops rare ones', () => {
    const out = computeWeakAreas({
      topics: [],
      errorHotspots: [
        { category: 'CASE', count: 5 },
        { category: 'TENSE', count: 2 }, // below MIN_ERRORS_FOR_HOTSPOT
      ],
    });
    expect(out).toEqual(['падежи']);
  });

  it('dedupes a topic title against an identical hotspot label and caps the list', () => {
    const out = computeWeakAreas({
      topics: [
        { title: 'падежи', decayed: 0.1 },
        { title: 'a', decayed: 0.11 },
        { title: 'b', decayed: 0.12 },
        { title: 'c', decayed: 0.13 },
        { title: 'd', decayed: 0.14 },
        { title: 'e', decayed: 0.15 },
        { title: 'f', decayed: 0.16 }, // 7th weak topic
      ],
      errorHotspots: [{ category: 'CASE', count: 9 }], // "падежи" already present
    });
    expect(out).toHaveLength(6); // capped
    expect(out.filter((x) => x.toLowerCase() === 'падежи')).toHaveLength(1); // deduped
  });
});

describe('diffClearedAreas', () => {
  it('returns areas present before but gone now', () => {
    expect(diffClearedAreas(['A', 'B', 'C'], ['A', 'C'])).toEqual(['B']);
  });

  it('is case-insensitive (no false clear)', () => {
    expect(diffClearedAreas(['Падежи'], ['падежи'])).toEqual([]);
  });
});

describe('pickStreakMilestones', () => {
  it('returns all reached, not-yet-emitted milestones', () => {
    expect(pickStreakMilestones(30, [])).toEqual([7, 14, 30]);
  });

  it('skips already-emitted ones', () => {
    expect(pickStreakMilestones(30, [7, 14])).toEqual([30]);
  });

  it('returns nothing below the first milestone', () => {
    expect(pickStreakMilestones(5, [])).toEqual([]);
  });

  it('does not re-emit a milestone already recorded this streak', () => {
    expect(pickStreakMilestones(8, [7])).toEqual([]);
  });
});
