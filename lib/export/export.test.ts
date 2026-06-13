import { describe, expect, it } from 'vitest';
import { toCsv } from './index';

describe('toCsv', () => {
  it('joins headers and rows', () => {
    expect(toCsv(['a', 'b'], [[1, 2], [3, 4]])).toBe('a,b\n1,2\n3,4');
  });

  it('escapes commas/quotes and blanks null/undefined', () => {
    expect(toCsv(['x', 'y'], [['a,b', 'he said "hi"'], [null, 5]])).toBe('x,y\n"a,b","he said ""hi"""\n,5');
  });

  it('serializes objects as JSON', () => {
    expect(toCsv(['o'], [[{ a: 1 }]])).toBe('o\n"{""a"":1}"');
  });
});
