import { describe, expect, it } from 'vitest';
import { bktUpdate } from './bkt';

describe('bkt mastery update', () => {
  it('a wrong answer lowers mastery; a correct answer raises it (acceptance #1)', () => {
    const start = 0.6;
    expect(bktUpdate(start, false)).toBeLessThan(start);
    expect(bktUpdate(start, true)).toBeGreaterThan(start);
  });

  it('treats prior<=0 as unseen (starts from L0)', () => {
    const afterCorrect = bktUpdate(0, true);
    expect(afterCorrect).toBeGreaterThan(0.1); // moved up from L0=0.1
    expect(afterCorrect).toBeLessThan(1);
  });

  it('converges upward with repeated correct and stays within [0,1]', () => {
    let p = 0.1;
    for (let i = 0; i < 10; i++) p = bktUpdate(p, true);
    expect(p).toBeGreaterThan(0.9);
    expect(p).toBeLessThanOrEqual(1);
  });

  it('drives mastery down with repeated wrong answers', () => {
    let p = 0.8;
    for (let i = 0; i < 10; i++) p = bktUpdate(p, false);
    expect(p).toBeLessThan(0.2);
    expect(p).toBeGreaterThanOrEqual(0);
  });
});
