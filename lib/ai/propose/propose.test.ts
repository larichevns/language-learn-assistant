import { describe, expect, it } from 'vitest';
import { applyProposal, parseProposeCall } from './dispatch';
import type { ToolCall } from '../types';

function call(args: Record<string, unknown>): ToolCall {
  return { name: 'propose', args };
}

describe('propose parse + validate + apply', () => {
  it('parses a JSON-string payload, validates, and distills a vocab row', () => {
    const parsed = parseProposeCall(
      call({
        target_type: 'VOCAB_ENTRY',
        op: 'CREATE',
        summary: 'Добавить слово: der Tisch',
        payload: JSON.stringify({
          lemma: 'der Tisch',
          pos: 'NOUN',
          translationRu: 'стол',
          gender: 'DER',
          pluralForm: 'Tische',
          cefrLevel: 'A1',
        }),
      }),
    );
    expect(parsed.targetType).toBe('VOCAB_ENTRY');
    expect(parsed.op).toBe('CREATE');

    const applied = applyProposal(parsed);
    expect(applied.row.lemma).toBe('der Tisch');
    expect(applied.row.gender).toBe('DER');
    expect(applied.row.pluralForm).toBe('Tische');
  });

  it('accepts an object payload (not only a JSON string)', () => {
    const parsed = parseProposeCall(
      call({
        target_type: 'GRAMMAR_TOPIC',
        summary: 'Perfekt',
        payload: { title: 'Perfekt', category: 'TENSE', explanationRu: 'haben/sein + Partizip II' },
      }),
    );
    const applied = applyProposal(parsed);
    expect(applied.row.title).toBe('Perfekt');
  });

  it('rejects an invalid payload (missing required fields)', () => {
    const parsed = parseProposeCall(
      call({ target_type: 'VOCAB_ENTRY', summary: 'x', payload: JSON.stringify({ lemma: 'x' }) }),
    );
    expect(() => applyProposal(parsed)).toThrow();
  });

  it('rejects an unknown target_type', () => {
    expect(() => parseProposeCall(call({ target_type: 'NOPE', summary: 'x', payload: '{}' }))).toThrow();
  });
});
