import { describe, expect, it } from 'vitest';
import { capText, estimateTokens } from './caps';

describe('capText', () => {
  it('returns input unchanged when within the cap', () => {
    expect(capText('abc', 10)).toBe('abc');
  });

  it('trims with an ellipsis when over the cap', () => {
    expect(capText('abcdef', 4)).toBe('abc…');
    expect(capText('abcdef', 4).length).toBe(4);
  });
});

describe('estimateTokens', () => {
  it('approximates ~3 chars per token', () => {
    expect(estimateTokens('abcdef')).toBe(2);
  });
});
