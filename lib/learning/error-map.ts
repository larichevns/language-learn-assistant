/**
 * Map homework error types (the German correction contract) to BKT skill
 * categories, and coerce the model's free-string `errorType` into the enum.
 * See vault/specs/phase-5-implementation-plan.md §2.2.
 */
import type { GrammarCategory, HomeworkErrorType } from '@prisma/client';

/** Homework error type → grammar skill category (for BKT mastery). */
export function errorTypeToCategory(t: HomeworkErrorType): GrammarCategory {
  switch (t) {
    case 'KASUS':
      return 'CASE';
    case 'GENUS':
    case 'ARTIKEL':
      return 'ARTICLE';
    case 'WORTSTELLUNG':
      return 'WORD_ORDER';
    case 'VERBKONJUGATION':
      return 'VERB_CONJUGATION';
    case 'PRAEPOSITION':
      return 'PREPOSITION';
    case 'ZEITFORM':
      return 'TENSE';
    default: // NUMERUS, RECHTSCHREIBUNG, SONSTIGES
      return 'OTHER';
  }
}

// The model labels errors in German (per the persona contract) but spelling
// varies (umlauts, English synonyms). Normalize to the enum; unknown → SONSTIGES.
const ERROR_TYPE_ALIASES: Record<string, HomeworkErrorType> = {
  KASUS: 'KASUS', CASE: 'KASUS', FALL: 'KASUS', AKKUSATIV: 'KASUS', DATIV: 'KASUS', GENITIV: 'KASUS',
  GENUS: 'GENUS', GENDER: 'GENUS',
  NUMERUS: 'NUMERUS', NUMBER: 'NUMERUS', PLURAL: 'NUMERUS',
  WORTSTELLUNG: 'WORTSTELLUNG', WORDORDER: 'WORTSTELLUNG', WORD_ORDER: 'WORTSTELLUNG', SATZSTELLUNG: 'WORTSTELLUNG',
  VERBKONJUGATION: 'VERBKONJUGATION', KONJUGATION: 'VERBKONJUGATION', CONJUGATION: 'VERBKONJUGATION', VERB: 'VERBKONJUGATION',
  PRAEPOSITION: 'PRAEPOSITION', PRÄPOSITION: 'PRAEPOSITION', PREPOSITION: 'PRAEPOSITION',
  ARTIKEL: 'ARTIKEL', ARTICLE: 'ARTIKEL',
  RECHTSCHREIBUNG: 'RECHTSCHREIBUNG', SPELLING: 'RECHTSCHREIBUNG', ORTHOGRAFIE: 'RECHTSCHREIBUNG', ORTHOGRAPHIE: 'RECHTSCHREIBUNG',
  ZEITFORM: 'ZEITFORM', TENSE: 'ZEITFORM', TEMPUS: 'ZEITFORM', PERFEKT: 'ZEITFORM',
  SONSTIGES: 'SONSTIGES', OTHER: 'SONSTIGES', SONSTIGE: 'SONSTIGES',
};

export function normalizeErrorType(raw: string | null | undefined): HomeworkErrorType {
  if (!raw) return 'SONSTIGES';
  const key = raw.trim().toUpperCase().replace(/[\s-]+/g, '_');
  return ERROR_TYPE_ALIASES[key] ?? 'SONSTIGES';
}

// Short RU labels for grammar skill categories — used when the nightly rollup
// derives a weak-area from an error hotspot that isn't tied to a named topic.
// These are stable enum→display strings (not learner content), safe to inline.
const CATEGORY_LABEL_RU: Record<GrammarCategory, string> = {
  ARTICLE: 'артикли (der/die/das)',
  CASE: 'падежи',
  TENSE: 'времена глагола',
  VERB_CONJUGATION: 'спряжение глаголов',
  SEPARABLE_VERB: 'отделяемые приставки',
  MODAL_VERB: 'модальные глаголы',
  PREPOSITION: 'предлоги',
  PRONOUN: 'местоимения',
  ADJECTIVE_DECLENSION: 'склонение прилагательных',
  WORD_ORDER: 'порядок слов',
  NEGATION: 'отрицание',
  SUBJUNCTIVE: 'Konjunktiv',
  PASSIVE: 'пассив',
  OTHER: 'прочее',
};

export function categoryLabelRu(category: GrammarCategory): string {
  return CATEGORY_LABEL_RU[category] ?? CATEGORY_LABEL_RU.OTHER;
}
