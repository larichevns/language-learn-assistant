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

// Regression: the model emits non-canonical shapes for the nested payloads
// (flat single correction; `exercises`/`question`/`correctAnswer`; type
// `FILL_IN_THE_BLANK`). These used to pass persist but 500 at Apply.
// See debugging/propose-Apply-500-на-вложенных-payload-из-за-формы-модели.
describe('propose payload coercion (model-shape tolerance)', () => {
  it('wraps a FLAT homework correction (no corrections[] array) and maps explanation→explanationRu', () => {
    const parsed = parseProposeCall(
      call({
        target_type: 'HOMEWORK_CORRECTION',
        summary: 'Исправление: Kasus',
        payload: JSON.stringify({
          original: 'Ich sehe der Chef.',
          corrected: 'Ich sehe den Chef.',
          errorType: 'Kasus',
          explanation: 'sehen + Akkusativ → den Chef.',
        }),
      }),
    );
    const { row } = applyProposal(parsed);
    const corrections = row.corrections as Array<Record<string, string>>;
    expect(Array.isArray(corrections)).toBe(true);
    expect(corrections).toHaveLength(1);
    expect(corrections[0]!.original).toBe('Ich sehe der Chef.');
    expect(corrections[0]!.errorType).toBe('Kasus');
    expect(corrections[0]!.explanationRu).toBe('sehen + Akkusativ → den Chef.');
  });

  it('maps exercise set `exercises`→`items`, question→prompt, correctAnswer→answer, FILL_IN_THE_BLANK→CLOZE', () => {
    const parsed = parseProposeCall(
      call({
        target_type: 'EXERCISE_SET',
        summary: 'Упражнения',
        payload: JSON.stringify({
          title: 'Артикли',
          cefrLevel: 'A2',
          exercises: [
            { type: 'FILL_IN_THE_BLANK', question: 'Ich sehe ___ Katze.', correctAnswer: 'die', explanationRu: 'ж. род' },
          ],
        }),
      }),
    );
    const { row } = applyProposal(parsed);
    const items = row.items as Array<Record<string, string>>;
    expect(items).toHaveLength(1);
    expect(items[0]!.type).toBe('CLOZE');
    expect(items[0]!.prompt).toBe('Ich sehe ___ Katze.');
    expect(items[0]!.answer).toBe('die');
    expect(items[0]!.explanationRu).toBe('ж. род');
  });

  it('keeps a correctly-shaped corrections[] array unchanged', () => {
    const parsed = parseProposeCall(
      call({
        target_type: 'HOMEWORK_CORRECTION',
        summary: 'ok',
        payload: JSON.stringify({
          corrections: [{ original: 'a', corrected: 'b', errorType: 'Artikel', explanationRu: 'x' }],
        }),
      }),
    );
    const { row } = applyProposal(parsed);
    expect((row.corrections as unknown[]).length).toBe(1);
  });
});
