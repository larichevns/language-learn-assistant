/**
 * Assembles envelope DATA from the source of truth. In Phase 1 the source is a
 * JSON seed file; in Phase 2 the same shape is built from Postgres. "Chat is a
 * desk, DB is the memory" — this is where the memory becomes a prompt.
 */
import type { Message } from '../types';
import { THREAD_TAIL } from './caps';
import {
  SYSTEM_PERSONA,
  formatScope,
  formatShared,
  formatThreadSummary,
  formatUnit,
} from './layers';
import type { EnvelopeData } from './builder';

export interface SeedVocab {
  lemma: string;
  pos?: string;
  translationRu?: string;
  gender?: string;
  pluralForm?: string;
  auxiliary?: string;
  partizipII?: string;
  isSeparable?: boolean;
  separablePrefix?: string;
  cefrLevel?: string;
  mastery?: number;
}

export interface SeedGrammar {
  title: string;
  category?: string;
  explanationRu?: string;
  masteryScore?: number;
}

export interface SeedThreadMessage {
  role: 'user' | 'model';
  content: string;
}

export interface Seed {
  profile: {
    cefrLevel?: string;
    nativeLang?: string;
    targetLang?: string;
    goals?: string[];
    weakAreas?: string[];
    formalityPref?: string;
  };
  vocab: SeedVocab[];
  grammarTopics: SeedGrammar[];
  currentUnit?: { title?: string; premise?: string; summary?: string };
  thread: {
    scopeType: string;
    scopeId?: string | null;
    summary?: string;
    messages: SeedThreadMessage[];
  };
  /** Optional named scope objects, addressable by the CLI (e.g. "GRAMMAR_TOPIC:Perfekt"). */
  scopeObjects?: Record<string, unknown>;
}

export interface AssembleOptions {
  scopeType?: string;
  featureSlug?: string;
  scopeObject?: unknown;
  userMessage: string;
}

export function assembleEnvelope(seed: Seed, opts: AssembleOptions): EnvelopeData {
  const scopeType = opts.scopeType ?? seed.thread.scopeType ?? 'GLOBAL';

  const shared = formatShared({
    profile: seed.profile,
    vocab: seed.vocab,
    grammarTopics: seed.grammarTopics,
  });
  const unit = formatUnit(seed.currentUnit);
  const scope = formatScope(scopeType, opts.scopeObject, opts.featureSlug);
  const threadSummary = formatThreadSummary(seed.thread.summary);

  const history: Message[] = (seed.thread.messages ?? [])
    .filter((m) => m.role === 'user' || m.role === 'model')
    .slice(-THREAD_TAIL)
    .map((m) => ({ role: m.role, content: m.content }));

  return {
    system: SYSTEM_PERSONA,
    shared,
    unit,
    scope,
    threadSummary,
    history,
    userMessage: opts.userMessage,
  };
}
