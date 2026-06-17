/**
 * GRAMMAR_TOPIC payload tolerance — regression for the live-found Apply 500.
 * The model emits non-canonical grammar shapes (content under contentRu, an
 * invalid category like "CASES", pitfallsRu, rules-only with no explanationRu).
 * GrammarTopicPayload.parse must normalize them instead of throwing (which
 * surfaced as an Apply 500). See [[propose-Apply-500-на-вложенных-payload-из-за-формы-модели]].
 */
import { describe, expect, it } from 'vitest';
import { GrammarTopicPayload } from './tool';

describe('GrammarTopicPayload tolerance', () => {
  it('maps contentRu→explanationRu, keeps valid category + group routing (live Akkusativ payload)', () => {
    const raw = {
      group: 'Грамматика', title: 'Akkusativ (винительный падеж)', category: 'CASE',
      subgroup: 'Падежи', cefrLevel: 'A2', contentDe: 'Der Akkusativ …',
      contentRu: 'Аккузатив — винительный падеж, отвечает на Wen?/Was?.',
    };
    const p = GrammarTopicPayload.parse(raw) as Record<string, unknown>;
    expect(p.category).toBe('CASE');
    expect(p.explanationRu).toBe('Аккузатив — винительный падеж, отвечает на Wen?/Was?.');
    expect(p.group).toBe('Грамматика');
    expect(p.subgroup).toBe('Падежи');
  });

  it('coerces invalid category "CASES"→CASE, pitfallsRu→pitfalls, synthesizes explanationRu from rules (live Genitiv payload)', () => {
    const raw = {
      group: 'Падежи', title: 'Genitiv (Родительный падеж)', category: 'CASES', subgroup: 'Genitiv', cefrLevel: 'B1',
      rules: [
        { rule: 'des + существительное (-s/-es)', examples: ['das Auto des Mannes'] },
        { rule: 'Порядок: обычно после существительного' },
      ],
      examples: [{ de: 'das Buch des Kindes', ru: 'книга ребёнка' }],
      pitfallsRu: ['В разговорной речи часто заменяется на von + Dativ'],
      declensionTable: { m: 'des' },
    };
    const p = GrammarTopicPayload.parse(raw) as Record<string, unknown>;
    expect(p.category).toBe('CASE');
    expect((p.explanationRu as string).length).toBeGreaterThan(0); // synthesized from rules
    expect(p.pitfalls).toEqual(['В разговорной речи часто заменяется на von + Dativ']);
    expect((p.rules as unknown[]).length).toBe(2);
    expect(p.examples).toEqual([{ de: 'das Buch des Kindes', ru: 'книга ребёнка', highlight: null }]);
    expect('declensionTable' in p).toBe(false); // unknown key stripped, never reaches Prisma
  });

  it('coerces an unknown category to OTHER and tolerates bare-string rules/examples', () => {
    const raw = { title: 'Etwas', category: 'WeirdThing', explanation: 'кратко', rules: ['правило один'], examples: ['Ein Satz.'] };
    const p = GrammarTopicPayload.parse(raw) as Record<string, unknown>;
    expect(p.category).toBe('OTHER');
    expect(p.explanationRu).toBe('кратко');
    expect(p.rules).toEqual([{ rule: 'правило один', examples: null }]);
    expect(p.examples).toEqual([{ de: 'Ein Satz.', ru: '', highlight: null }]);
  });

  it('flattens object-shaped rules and {de,ru} rule-examples to strings (never "[object Object]")', () => {
    const raw = {
      title: 'Plural', category: 'NOUN',
      rules: [
        { rule: { text: 'Окончание -e (часто м.р.)' }, examples: [{ de: 'der Tag → die Tage', ru: 'день → дни' }] },
        { rule: 'Окончание -er', examples: ['das Kind → die Kinder'] },
      ],
    };
    const p = GrammarTopicPayload.parse(raw) as Record<string, unknown>;
    expect(p.category).toBe('OTHER'); // NOUN isn't a grammar category
    expect(p.rules).toEqual([
      { rule: 'Окончание -e (часто м.р.)', examples: ['der Tag → die Tage'] },
      { rule: 'Окончание -er', examples: ['das Kind → die Kinder'] },
    ]);
    expect(p.explanationRu).not.toContain('[object Object]'); // synthesized from real rule text
    expect(p.explanationRu).toContain('Окончание -e');
  });

  it('leaves a canonical payload intact', () => {
    const raw = {
      title: 'Perfekt mit haben/sein', category: 'TENSE',
      explanationRu: 'Perfekt = haben/sein + Partizip II.',
      pitfalls: ['Bewegungsverben → sein'],
    };
    const p = GrammarTopicPayload.parse(raw) as Record<string, unknown>;
    expect(p.category).toBe('TENSE');
    expect(p.explanationRu).toContain('Partizip II');
    expect(p.pitfalls).toEqual(['Bewegungsverben → sein']);
  });
});
