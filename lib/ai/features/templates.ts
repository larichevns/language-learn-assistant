/**
 * Feature registry (Phase 1 in-code; Phase 2 → DB `FeatureFlag` + `PromptTemplate`
 * + `ModelRouting`). Each feature picks a model, a reasoning effort, the propose
 * targets it may emit, and — for non-chat features — its own system/user prompt.
 */
import type { ReasoningEffort } from '../types';
import { PROPOSE_TARGET_TYPES, type ProposeTargetType } from '../propose/tool';

export interface FeatureSpec {
  slug: string;
  /** default model id (free-tier friendly) */
  model: string;
  reasoningEffort: ReasoningEffort;
  proposeTargets: ProposeTargetType[];
  /** background ops never bill and skip rate limits */
  isBackground?: boolean;
  /** non-chat features override the envelope persona with their own prompt */
  systemPrompt?: string;
  userPromptTemplate?: string;
}

const CHAT_MODEL = 'gemini-2.5-flash';
const CHEAP_MODEL = 'gemini-2.5-flash-lite';

export const FEATURES: Record<string, FeatureSpec> = {
  // 'low' (not 'minimal') so the model actually reasons through German morphology
  // when auto-enriching a card from a short instruction. Tune per free-tier budget.
  tutor_chat: {
    slug: 'tutor_chat',
    model: CHAT_MODEL,
    reasoningEffort: 'low',
    proposeTargets: [...PROPOSE_TARGET_TYPES],
  },
  homework_correct: {
    slug: 'homework_correct',
    model: CHAT_MODEL,
    reasoningEffort: 'low',
    proposeTargets: ['HOMEWORK_CORRECTION', 'GRAMMAR_TOPIC', 'VOCAB_ENTRY'],
  },
  exercise_generate: {
    slug: 'exercise_generate',
    model: CHAT_MODEL,
    reasoningEffort: 'low',
    proposeTargets: ['EXERCISE_SET', 'VOCAB_ENTRY'],
  },
  vocab_extract: {
    slug: 'vocab_extract',
    model: CHAT_MODEL,
    reasoningEffort: 'low',
    proposeTargets: ['VOCAB_ENTRY'],
  },
  grammar_explain: {
    slug: 'grammar_explain',
    model: CHAT_MODEL,
    // 'medium' (was 'low') → 8192 thinking tokens (gemini.ts mapThinking) for a
    // deeper, structured explanation. Scoped to this one infrequent feature;
    // tutor_chat (the hot path) deliberately stays 'low'.
    reasoningEffort: 'medium',
    proposeTargets: ['GRAMMAR_TOPIC', 'EXERCISE_SET'],
  },
  thread_summarize: {
    slug: 'thread_summarize',
    model: CHEAP_MODEL,
    reasoningEffort: 'minimal',
    proposeTargets: [],
    isBackground: true,
    systemPrompt:
      'You maintain a ROLLING Russian summary of a German-tutoring dialogue. The input may begin with the existing summary, followed by newer turns — merge them into ONE consolidated summary (do not just append, do not drop facts from the existing summary). Keep: decisions made, which German words/grammar were hard, open questions, exercise progress. Output ≤ 250 words, in Russian, plain text.',
    userPromptTemplate: 'Обнови свёрнутую сводку треда из этого материала:\n\n{{dialogue}}',
  },
  // Nightly rollup's optional weekly note. Background → never bills, skips limits.
  // Uses the chat model (not lite) for tighter format adherence — `cleanNote`
  // still strips any stray markdown as a safety net. Language is NOT hardcoded:
  // the prompt replies in the learner's native language from the data payload.
  progress_summary: {
    slug: 'progress_summary',
    model: CHAT_MODEL,
    reasoningEffort: 'minimal',
    proposeTargets: [],
    isBackground: true,
    systemPrompt:
      'You write a short, warm weekly progress note for a language learner. Reply ONLY in the learner\'s native language (given in the data). Ground every statement strictly in the numbers provided — never invent progress. 2–4 sentences ending with one concrete thing to focus on next. PLAIN TEXT ONLY: no markdown, no asterisks, no headings, no bullet lists. Do NOT greet ("Привет"/"Hi") and do NOT sign off — start directly with the substance.',
  },
};

export function getFeature(slug: string): FeatureSpec {
  const f = FEATURES[slug];
  if (!f) throw new Error(`Unknown feature: ${slug}`);
  return f;
}
