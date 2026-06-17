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
          "A JSON object encoded as a string with the COMPLETE content. Shape depends on target_type. For VOCAB_ENTRY: {lemma, pos (NOUN|VERB|ADJECTIVE|...), translationRu, gender (the ARTICLE 'DER'|'DIE'|'DAS' for nouns — never 'masculine'), pluralForm, genitiveForm, isSeparable, separablePrefix, auxiliary ('HABEN'|'SEIN'), partizipII, praeteritum, governsCase ('NOMINATIV'|'AKKUSATIV'|'DATIV'|'GENITIV'), cefrLevel ('A1'..'C2'), tags:[...], examples:[{de,ru}], group (broad theme name, e.g. \"Еда\"), subgroup (narrow facet, e.g. \"Овощи\"), and OPTIONALLY groupId/subgroupId copied from a {g:id} token in the Shared \"Vocabulary groups\" block to REUSE an existing group instead of duplicating it}. For HOMEWORK_CORRECTION: {corrections:[{original, corrected, errorType (Kasus|Genus|Numerus|Wortstellung|Verbkonjugation|Präposition|Artikel|Rechtschreibung|Zeitform|Sonstiges), explanationRu}]} — ALWAYS a `corrections` ARRAY (one entry per mistake); the homework is bound automatically, do not invent an id. For EXERCISE_SET: {title, cefrLevel, items:[{type (CLOZE|MCQ|TRANSLATION_RU_DE|TRANSLATION_DE_RU|ARTICLE_GENDER|PERFEKT_FORM|CONJUGATION|WORD_ORDER|CASE_DECLENSION|PLURAL_FORM|SEPARABLE_VERB|MATCHING), prompt, answer, acceptableAnswers:[...], explanationRu}]} — the field is `items` with `prompt`+`answer`. For GRAMMAR_TOPIC: also set `group` (broad theme, e.g. \"Времена\") and `subgroup` (narrow, e.g. \"Прошедшее\"); to REUSE, copy a {g:id} token FROM the Shared \"Grammar groups\" block into groupId/subgroupId — never from another domain's block. For CLASS_NOTE: same, reusing from the \"Note groups\" block. The `category` enum on a grammar topic is separate from its `group` — set both.",
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
  group: z.string().nullish(),
  subgroup: z.string().nullish(),
  groupId: z.string().nullish(),
  subgroupId: z.string().nullish(),
});

// GrammarTopicPayload is defined below, after the shared normalizers — it needs
// the same tolerant z.preprocess treatment as corrections/exercises (the model
// emits non-canonical grammar shapes: content under `contentRu`/`explanation`,
// `pitfallsRu`, an invalid `category` like "CASES"). See normGrammarTopic.

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

// ── GRAMMAR_TOPIC tolerance (same defensive pattern as corrections/exercises) ──
// The model emits grammar payloads in non-canonical shapes: content under
// `contentRu`/`explanation`, pitfalls under `pitfallsRu`, an invalid `category`
// like "CASES", rules/examples as bare strings or alt keys. Normalize to the
// canonical schema BEFORE validation so a correct answer isn't rejected (which
// otherwise surfaces as an Apply 500). See debugging note
// [[propose-Apply-500-на-вложенных-payload-из-за-формы-модели]].
const GRAMMAR_CATEGORIES = new Set([
  'ARTICLE', 'CASE', 'TENSE', 'VERB_CONJUGATION', 'SEPARABLE_VERB', 'MODAL_VERB',
  'PREPOSITION', 'PRONOUN', 'ADJECTIVE_DECLENSION', 'WORD_ORDER', 'NEGATION',
  'SUBJUNCTIVE', 'PASSIVE', 'OTHER',
]);
const GRAMMAR_CATEGORY_SYNONYMS: Record<string, string> = {
  CASES: 'CASE', KASUS: 'CASE', FALL: 'CASE', DECLENSION: 'CASE',
  ARTICLES: 'ARTICLE', ARTIKEL: 'ARTICLE',
  TENSES: 'TENSE', ZEITFORM: 'TENSE', ZEITFORMEN: 'TENSE', TEMPUS: 'TENSE',
  CONJUGATION: 'VERB_CONJUGATION', VERB: 'VERB_CONJUGATION', VERBS: 'VERB_CONJUGATION',
  MODAL: 'MODAL_VERB', MODALS: 'MODAL_VERB', MODALVERB: 'MODAL_VERB',
  SEPARABLE: 'SEPARABLE_VERB', SEPARABLEVERB: 'SEPARABLE_VERB',
  PREPOSITIONS: 'PREPOSITION', PRÄPOSITION: 'PREPOSITION', PRAEPOSITION: 'PREPOSITION',
  PRONOUNS: 'PRONOUN', PRONOMEN: 'PRONOUN',
  ADJECTIVE: 'ADJECTIVE_DECLENSION', ADJECTIVES: 'ADJECTIVE_DECLENSION', ADJEKTIV: 'ADJECTIVE_DECLENSION',
  WORDORDER: 'WORD_ORDER', SYNTAX: 'WORD_ORDER', SATZBAU: 'WORD_ORDER',
  KONJUNKTIV: 'SUBJUNCTIVE', SUBJUNCTIV: 'SUBJUNCTIVE',
  PASSIV: 'PASSIVE',
  NEGATIONS: 'NEGATION', VERNEINUNG: 'NEGATION',
};
function normGrammarCategory(v: unknown): string {
  if (typeof v !== 'string') return 'OTHER';
  const up = v.trim().toUpperCase().replace(/[\s-]+/g, '_');
  if (GRAMMAR_CATEGORIES.has(up)) return up;
  return GRAMMAR_CATEGORY_SYNONYMS[up] ?? 'OTHER';
}
function normGrammarExample(e: unknown): unknown {
  if (typeof e === 'string') return { de: e, ru: '', highlight: null };
  const r = rec(e);
  if (!r) return { de: String(e ?? ''), ru: '', highlight: null };
  return {
    de: firstString(r.de, r.german, r.satz, r.sentence, r.example, r.text),
    ru: firstString(r.ru, r.russian, r.translation, r.uebersetzung, r['übersetzung']),
    highlight: typeof r.highlight === 'string' ? r.highlight : null,
  };
}
const pickStr = (o: Record<string, unknown>, keys: string[]): string => {
  for (const k of keys) {
    const val = o[k];
    if (typeof val === 'string' && val.trim()) return val;
  }
  return '';
};
/** A grammar rule → display string. The model emits `rule` as a string OR a
 *  nested object; flatten to a string (never "[object Object]"). */
function ruleText(r: unknown): string {
  if (typeof r === 'string') return r;
  const o = rec(r);
  if (!o) return '';
  const direct = pickStr(o, ['rule', 'text', 'title', 'name', 'description', 'explanation', 'content', 'de', 'ru']);
  if (direct) return direct;
  const nested = rec(o.rule);
  if (nested) {
    const n = pickStr(nested, ['text', 'title', 'name', 'description', 'explanation', 'rule', 'de', 'ru']);
    if (n) return n;
    const joinedNested = Object.values(nested).filter((x): x is string => typeof x === 'string' && !!x.trim()).join(' — ');
    if (joinedNested) return joinedNested;
  }
  return Object.values(o).filter((x): x is string => typeof x === 'string' && !!x.trim()).join(' — ');
}
/** A rule's inline example → a German string (the detail UI reads it aloud). */
function ruleExampleText(x: unknown): string {
  if (typeof x === 'string') return x;
  const o = rec(x);
  if (!o) return '';
  return pickStr(o, ['de', 'german', 'satz', 'sentence', 'example', 'text', 'ru']);
}
function normGrammarTopic(v: unknown): unknown {
  const o = rec(v);
  if (!o) return v;
  // rules → [{ rule:string, examples?:string[] }]. `rule` may be a string OR a
  // nested object, examples strings OR {de,ru}; flatten both to strings so the
  // schema + detail UI never receive an object (→ "[object Object]").
  let rules = o.rules ?? o.rulesJson ?? null;
  if (Array.isArray(rules))
    rules = rules.map((r) => {
      const rr = rec(r);
      const ex = rr && Array.isArray(rr.examples) ? rr.examples.map(ruleExampleText).filter(Boolean) : null;
      return { rule: ruleText(r), examples: ex && ex.length ? ex : null };
    });
  // examples → [{ de, ru, highlight? }]; accept bare strings / alt keys.
  let examples = o.examples ?? o.beispiele ?? null;
  if (Array.isArray(examples)) examples = examples.map(normGrammarExample);
  // explanationRu is REQUIRED by the schema; the model often puts it under another
  // key or omits it (content lives only in rules). Map alternates, then synthesize
  // from the rules so a rules-only payload still applies.
  let explanationRu = firstString(
    o.explanationRu, o.explanation, o.contentRu, o.content, o.ruExplanation, o.descriptionRu, o.description,
  );
  if (!explanationRu && Array.isArray(rules) && rules.length)
    explanationRu = (rules as Array<{ rule?: string }>).map((r) => r.rule).filter(Boolean).join('\n\n');
  return {
    ...o,
    title: firstString(o.title, o.name, o.topic) || 'Грамматическая тема',
    category: normGrammarCategory(o.category ?? o.type),
    explanationRu,
    rules,
    examples,
    pitfalls: o.pitfalls ?? o.pitfallsRu ?? o.pitfall ?? null,
  };
}

// The canonical object shape — exported separately so the grammar [id] PATCH
// route can `.partial()` it (ZodEffects from z.preprocess has no `.partial()`).
export const GrammarTopicFields = z.object({
  title: z.string(),
  category: z.string(),
  cefrLevel: z.string().nullish(),
  explanationRu: z.string(),
  rules: z.array(z.object({ rule: z.string(), examples: z.array(z.string()).nullish() })).nullish(),
  examples: z.array(z.object({ de: z.string(), ru: z.string(), highlight: z.string().nullish() })).nullish(),
  pitfalls: z.array(z.string()).nullish(),
  // Browsable taxonomy routing (orthogonal to `category`); reuse via {g:id} from
  // the Shared "Grammar groups" block only — see resolveGroupId(domain:'GRAMMAR').
  group: z.string().nullish(),
  subgroup: z.string().nullish(),
  groupId: z.string().nullish(),
  subgroupId: z.string().nullish(),
});

export const GrammarTopicPayload = z.preprocess(normGrammarTopic, GrammarTopicFields);

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
  // Browsable taxonomy routing; reuse via {g:id} from the Shared "Note groups"
  // block only — see resolveGroupId(domain:'NOTE').
  group: z.string().nullish(),
  subgroup: z.string().nullish(),
  groupId: z.string().nullish(),
  subgroupId: z.string().nullish(),
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
