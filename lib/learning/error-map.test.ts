import { describe, expect, it } from 'vitest';
import { errorTypeToCategory, normalizeErrorType } from './error-map';

describe('homework error mapping', () => {
  it('normalizes German/English/umlaut labels (model output) to the enum', () => {
    expect(normalizeErrorType('Kasus')).toBe('KASUS');
    expect(normalizeErrorType('Wortstellung')).toBe('WORTSTELLUNG');
    expect(normalizeErrorType('Verbkonjugation')).toBe('VERBKONJUGATION');
    expect(normalizeErrorType('Präposition')).toBe('PRAEPOSITION');
    expect(normalizeErrorType('tense')).toBe('ZEITFORM');
    expect(normalizeErrorType('weird-unknown')).toBe('SONSTIGES');
    expect(normalizeErrorType(null)).toBe('SONSTIGES');
  });

  it('maps error types to BKT skill categories', () => {
    expect(errorTypeToCategory('KASUS')).toBe('CASE');
    expect(errorTypeToCategory('ARTIKEL')).toBe('ARTICLE');
    expect(errorTypeToCategory('GENUS')).toBe('ARTICLE');
    expect(errorTypeToCategory('WORTSTELLUNG')).toBe('WORD_ORDER');
    expect(errorTypeToCategory('ZEITFORM')).toBe('TENSE');
    expect(errorTypeToCategory('RECHTSCHREIBUNG')).toBe('OTHER');
  });
});
