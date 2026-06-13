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
    reasoningEffort: 'low',
    proposeTargets: ['GRAMMAR_TOPIC', 'EXERCISE_SET'],
  },
  thread_summarize: {
    slug: 'thread_summarize',
    model: CHEAP_MODEL,
    reasoningEffort: 'minimal',
    proposeTargets: [],
    isBackground: true,
    systemPrompt:
      'You compress a German-tutoring dialogue into a short Russian summary. Keep: decisions made, which German words were hard, open questions, exercise progress. Output ≤ 250 words, in Russian.',
    userPromptTemplate: 'Сожми этот диалог:\n\n{{dialogue}}',
  },
};

export function getFeature(slug: string): FeatureSpec {
  const f = FEATURES[slug];
  if (!f) throw new Error(`Unknown feature: ${slug}`);
  return f;
}
