import { describe, expect, it } from 'vitest';
import { detectMime, mapThinking } from './gemini';

describe('mapThinking', () => {
  it('uses an integer thinkingBudget for the 2.5 family', () => {
    expect(mapThinking('minimal', 'gemini-2.5-flash')).toEqual({ thinkingConfig: { thinkingBudget: 0 } });
    expect(mapThinking('low', 'gemini-2.5-flash')).toEqual({ thinkingConfig: { thinkingBudget: 1024 } });
    expect(mapThinking('high', 'gemini-2.5-flash')).toEqual({ thinkingConfig: { thinkingBudget: 24576 } });
  });

  it('uses a string thinkingLevel for 3.x', () => {
    expect(mapThinking('low', 'gemini-3-pro')).toEqual({ thinkingConfig: { thinkingLevel: 'low' } });
  });

  it('is a no-op when no effort is given', () => {
    expect(mapThinking(undefined, 'gemini-2.5-flash')).toEqual({});
  });
});

describe('detectMime', () => {
  it('recognizes PNG and JPEG by magic bytes', () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]).toString('base64');
    const jpg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]).toString('base64');
    expect(detectMime(png)).toBe('image/png');
    expect(detectMime(jpg)).toBe('image/jpeg');
  });
});
