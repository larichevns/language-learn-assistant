/**
 * The `propose` tool — the model's ONLY write path. One polymorphic function
 * declaration; the payload is a JSON STRING (loose at the model layer) that the
 * server JSON-parses and validates against a strict per-target zod schema.
 */
import { z } from 'zod';
import type { ToolDecl } from '../types';

export const PROPOSE_TARGET_TYPES = [
  'VOCAB_ENTRY',
  'GRAMMAR_TOPIC',
  'HOMEWORK_CORRECTION',
  'CLASS_NOTE',
  'EXERCISE_SET',
  'UNIT',
  'LEARNER_PROFILE',
  'LEARNER_PREFERENCE',
  'SRS_CARD',
] as const;
export type ProposeTargetType = (typeof PROPOSE_TARGET_TYPES)[number];

export const proposeToolDecl: ToolDecl = {
  name: 'propose',
  description:
    "Propose a change to the learner's saved data (a word, grammar note, homework correction, exercise set, profile field). Creates a card the learner can Apply, Refine or Discard. This is the ONLY way to save anything — nothing is saved until the learner Applies.",
  parameters: {
    type: 'OBJECT',
    properties: {
      target_type: {
        type: 'STRING',
        enum: [...PROPOSE_TARGET_TYPES],
        description: 'What kind of object to create or update.',
      },
      op: {
        type: 'STRING',
        enum: ['CREATE', 'UPDATE'],
        description: 'CREATE a new object, or UPDATE an existing one (then set target_id).',
      },
      target_id: {
        type: 'STRING',
        description: 'Id of the existing object when op=UPDATE. Omit for CREATE.',
      },
      summary: {
        type: 'STRING',
        description: 'Short human-readable card title in Russian, e.g. «Добавить слово: aufstehen».',
      },
      payload: {
        type: 'STRING',
        description:
          "A JSON object encoded as a string with the COMPLETE content. Shape depends on target_type. For VOCAB_ENTRY: {lemma, pos (NOUN|VERB|ADJECTIVE|...), translationRu, gender (the ARTICLE 'DER'|'DIE'|'DAS' for nouns — never 'masculine'), pluralForm, genitiveForm, isSeparable, separablePrefix, auxiliary ('HABEN'|'SEIN'), partizipII, praeteritum, governsCase ('NOMINATIV'|'AKKUSATIV'|'DATIV'|'GENITIV'), cefrLevel ('A1'..'C2'), tags:[...], examples:[{de,ru}]}. For HOMEWORK_CORRECTION: {corrections:[{original, corrected, errorType (Kasus|Genus|Numerus|Wortstellung|Verbkonjugation|Präposition|Artikel|Rechtschreibung|Zeitform|Sonstiges), explanationRu}]} — ALWAYS a `corrections` ARRAY (one entry per mistake); the homework is bound automatically, do not invent an id. For EXERCISE_SET: {title, cefrLevel, items:[{type (CLOZE|MCQ|TRANSLATION_RU_DE|TRANSLATION_DE_RU|ARTICLE_GENDER|PERFEKT_FORM|CONJUGATION|WORD_ORDER|CASE_DECLENSION|PLURAL_FORM|SEPARABLE_VERB|MATCHING), prompt, answer, acceptableAnswers:[...], explanationRu}]} — the field is `items` with `prompt`+`answer`.",
      },
    },
    required: ['target_type', 'summary', 'payload'],
  },
};

// ── Per-target payload schemas (strict, server-side) ─────────────────────────
const Example = z.object({ de: z.string(), ru: z.string() });

// Models sometimes say "masculine"/"m"/"Maskulinum" instead of the article.
// Coerce to der/die/das so a correct value isn't rejected on a naming quirk.
const GENDER_SYNONYMS: Record<string, 'DER' | 'DIE' | 'DAS'> = {
  DER: 'DER', DIE: 'DIE', DAS: 'DAS',
  MASCULINE: 'DER', FEMININE: 'DIE', NEUTER: 'DAS', NEUTRAL: 'DAS',
  MASKULIN: 'DER', FEMININ: 'DIE', NEUTRUM: 'DAS',
  MASKULINUM: 'DER', FEMININUM: 'DIE',
  M: 'DER', F: 'DIE', N: 'DAS',
};
const genderField = z.preprocess((v) => {
  if (typeof v !== 'string') return v;
  return GENDER_SYNONYMS[v.trim().toUpperCase()] ?? v;
}, z.enum(['DER', 'DIE', 'DAS']).nullish());

export const VocabEntryPayload = z.object({
  lemma: z.string(),
  pos: z.string(),
  translationRu: z.string(),
  gender: genderField,
  pluralForm: z.string().nullish(),
  genitiveForm: z.string().nullish(),
  isSeparable: z.boolean().nullish(),
  separablePrefix: z.string().nullish(),
  auxiliary: z.enum(['HABEN', 'SEIN']).nullish(),
  partizipII: z.string().nullish(),
  praeteritum: z.string().nullish(),
  presentIrregular: z.string().nullish(),
  isReflexive: z.boolean().nullish(),
  governsCase: z.enum(['NOMINATIV', 'AKKUSATIV', 'DATIV', 'GENITIV']).nullish(),
  cefrLevel: z.string().nullish(),
  tags: z.array(z.string()).nullish(),
  examples: z.array(Example).nullish(),
});

export const GrammarTopicPayload = z.object({
  title: z.string(),
  category: z.string(),
  cefrLevel: z.string().nullish(),
  explanationRu: z.string(),
  rules: z.array(z.object({ rule: z.string(), examples: z.array(z.string()).nullish() })).nullish(),
  examples: z.array(z.object({ de: z.string(), ru: z.string(), highlight: z.string().nullish() })).nullish(),
  pitfalls: z.array(z.string()).nullish(),
});

// The model emits these payloads as free-form JSON. It reliably uses sensible
// but non-canonical key names (`explanation`, `exercises`, `question`,
// `correctAnswer`) and, for corrections, a flat single object (it is told to
// send "one proposal per mistake"). Normalize those shapes to the canonical
// schema BEFORE validation so a correct answer isn't rejected on a naming quirk
// (same defensive pattern as `genderField` above). See debugging note
// [[propose-Apply-500-на-вложенных-payload-из-за-формы-модели]].
const rec = (v: unknown): Record<string, unknown> | null =>
  v != null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
const firstString = (...vs: unknown[]): string => {
  for (const v of vs) if (typeof v === 'string' && v.length) return v;
  return '';
};

function normCorrection(c: unknown): unknown {
  const r = rec(c);
  if (!r) return c;
  return {
    original: firstString(r.original, r.from, r.wrong),
    corrected: firstString(r.corrected, r.correction, r.to, r.fixed),
    errorType: firstString(r.errorType, r.type, r.category) || 'Sonstiges',
    case: r.case ?? null,
    gender: r.gender ?? null,
    explanationRu: firstString(r.explanationRu, r.explanation, r.explanationRU, r.reason),
  };
}
function normHomeworkCorrection(v: unknown): unknown {
  const o = rec(v);
  if (!o) return v;
  let arr: unknown = o.corrections;
  if (!Array.isArray(arr)) {
    const single = rec(o.correction) ?? ((o.original ?? o.corrected ?? o.errorType) != null ? o : null);
    arr = single ? [single] : [];
  }
  return { ...o, corrections: (arr as unknown[]).map(normCorrection) };
}

const EXERCISE_TYPES = new Set([
  'CLOZE', 'TRANSLATION_RU_DE', 'TRANSLATION_DE_RU', 'CONJUGATION', 'ARTICLE_GENDER',
  'PLURAL_FORM', 'CASE_DECLENSION', 'SEPARABLE_VERB', 'PERFEKT_FORM', 'MCQ', 'WORD_ORDER', 'MATCHING',
]);
const EXERCISE_TYPE_SYNONYMS: Record<string, string> = {
  FILL_IN_THE_BLANK: 'CLOZE', FILL_IN_BLANK: 'CLOZE', FILL_IN: 'CLOZE', FILL_BLANK: 'CLOZE',
  GAP_FILL: 'CLOZE', GAP: 'CLOZE', BLANK: 'CLOZE', FILL: 'CLOZE', LUECKENTEXT: 'CLOZE',
  MULTIPLE_CHOICE: 'MCQ', CHOICE: 'MCQ', SELECT: 'MCQ',
  TRANSLATION: 'TRANSLATION_RU_DE', TRANSLATE: 'TRANSLATION_RU_DE',
  ARTICLE: 'ARTICLE_GENDER', GENDER: 'ARTICLE_GENDER', ARTIKEL: 'ARTICLE_GENDER',
  PLURAL: 'PLURAL_FORM', CASE: 'CASE_DECLENSION', DECLENSION: 'CASE_DECLENSION', KASUS: 'CASE_DECLENSION',
  CONJUGATE: 'CONJUGATION', PERFEKT: 'PERFEKT_FORM', PERFECT: 'PERFEKT_FORM',
  SEPARABLE: 'SEPARABLE_VERB', ORDER: 'WORD_ORDER', WORDORDER: 'WORD_ORDER',
  MATCH: 'MATCHING', PAIR: 'MATCHING', PAIRS: 'MATCHING',
};
function normExerciseType(v: unknown): string {
  if (typeof v !== 'string') return 'CLOZE';
  const up = v.trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (EXERCISE_TYPES.has(up)) return up;
  return EXERCISE_TYPE_SYNONYMS[up] ?? 'CLOZE';
}
function normExerciseItem(it: unknown): unknown {
  const r = rec(it);
  if (!r) return it;
  return {
    type: normExerciseType(r.type),
    prompt: firstString(r.prompt, r.question, r.text, r.sentence, r.task),
    promptMeta: r.promptMeta ?? r.meta ?? null,
    options: r.options ?? r.choices ?? null,
    answer: firstString(r.answer, r.correctAnswer, r.correct, r.solution, r.expected),
    acceptableAnswers: r.acceptableAnswers ?? r.acceptable ?? r.alternatives ?? null,
    explanationRu: firstString(r.explanationRu, r.explanation, r.feedbackRu, r.reason) || null,
  };
}
function normExerciseSet(v: unknown): unknown {
  const o = rec(v);
  if (!o) return v;
  const raw = o.items ?? o.exercises ?? o.questions ?? o.tasks ?? o.exerciseItems;
  const out = { ...o };
  if (Array.isArray(raw)) out.items = raw.map(normExerciseItem);
  delete out.exercises; delete out.questions; delete out.tasks; delete out.exerciseItems;
  return out;
}

export const HomeworkCorrectionPayload = z.preprocess(
  normHomeworkCorrection,
  z.object({
    homeworkId: z.string().nullish(),
    structured: z.unknown().nullish(),
    corrections: z.array(
      z.object({
        original: z.string(),
        corrected: z.string(),
        errorType: z.string(),
        case: z.string().nullish(),
        gender: z.string().nullish(),
        explanationRu: z.string(),
      }),
    ),
    errorSummary: z.record(z.number()).nullish(),
  }),
);

export const ExerciseSetPayload = z.preprocess(
  normExerciseSet,
  z.object({
    title: z.string(),
    sourceType: z.string().nullish(),
    cefrLevel: z.string().nullish(),
    items: z.array(
      z.object({
        type: z.string(),
        prompt: z.string(),
        promptMeta: z.unknown().nullish(),
        options: z.array(z.string()).nullish(),
        answer: z.string(),
        acceptableAnswers: z.array(z.string()).nullish(),
        explanationRu: z.string().nullish(),
      }),
    ),
  }),
);

export const ClassNotePayload = z.object({
  classNoteId: z.string().nullish(),
  structured: z.unknown(),
});

export const UnitPayload = z.object({
  title: z.string(),
  cefrLevel: z.string().nullish(),
  premise: z.string().nullish(),
  orderIndex: z.number().nullish(),
});

export const LearnerProfilePayload = z.object({
  cefrLevel: z.string().nullish(),
  weakAreas: z.array(z.string()).nullish(),
  goals: z.array(z.string()).nullish(),
  formalityPref: z.string().nullish(),
});

export const LearnerPreferencePayload = z.object({
  key: z.string(),
  value: z.string(),
});

export const SrsCardPayload = z.object({
  vocabEntryId: z.string(),
  initialState: z.string().nullish(),
  directions: z.array(z.string()).nullish(),
});

export const PAYLOAD_SCHEMAS: Record<ProposeTargetType, z.ZodTypeAny> = {
  VOCAB_ENTRY: VocabEntryPayload,
  GRAMMAR_TOPIC: GrammarTopicPayload,
  HOMEWORK_CORRECTION: HomeworkCorrectionPayload,
  CLASS_NOTE: ClassNotePayload,
  EXERCISE_SET: ExerciseSetPayload,
  UNIT: UnitPayload,
  LEARNER_PROFILE: LearnerProfilePayload,
  LEARNER_PREFERENCE: LearnerPreferencePayload,
  SRS_CARD: SrsCardPayload,
};

export function isProposeTarget(value: string): value is ProposeTargetType {
  return (PROPOSE_TARGET_TYPES as readonly string[]).includes(value);
}
