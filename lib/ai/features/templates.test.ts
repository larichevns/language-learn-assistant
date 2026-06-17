/**
 * Tests for feature registry (templates.ts) and the reasoning-effort mapping
 * in the Gemini provider (gemini.ts).
 *
 * These lock the "only grammar_explain gets medium effort" decision — a regression
 * guard so the effort never accidentally escalates on the hot-path tutor_chat
 * (which would eat free-tier quota for every conversation turn).
 *
 * Coverage:
 *  T1  grammar_explain.reasoningEffort === 'medium' (the grammar-depth upgrade).
 *  T2  tutor_chat.reasoningEffort === 'low' (the hot path must stay cheap).
 *  T3  All other features stay at 'low' or 'minimal' (no accidental escalation).
 *  T4  mapThinking('medium', 'gemini-2.5-flash') → { thinkingConfig: { thinkingBudget: 8192 } }.
 *  T5  getFeature throws for an unknown slug.
 */
import { describe, expect, it } from 'vitest';
import { getFeature, FEATURES } from './templates';
import { mapThinking } from '../providers/gemini';

// ── T1 / T2: Grammar-depth lock ───────────────────────────────────────────────

describe('grammar_explain effort lock', () => {
  it('T1: grammar_explain.reasoningEffort is "medium" (the grammar-depth upgrade)', () => {
    const feat = getFeature('grammar_explain');
    expect(feat.reasoningEffort).toBe('medium');
  });

  it('T2: tutor_chat.reasoningEffort is "low" (hot path must stay cheap)', () => {
    const feat = getFeature('tutor_chat');
    expect(feat.reasoningEffort).toBe('low');
  });
});

// ── T3: No accidental effort escalation on other features ─────────────────────

describe('other features stay at low or minimal', () => {
  const NON_ESCALATED_FEATURES = ['homework_correct', 'exercise_generate', 'vocab_extract'];

  for (const slug of NON_ESCALATED_FEATURES) {
    it(`T3: ${slug}.reasoningEffort is 'low' or 'minimal' (not medium/high)`, () => {
      const feat = getFeature(slug);
      expect(['low', 'minimal']).toContain(feat.reasoningEffort);
    });
  }

  it('T3: background features (thread_summarize, progress_summary) stay at minimal', () => {
    expect(getFeature('thread_summarize').reasoningEffort).toBe('minimal');
    expect(getFeature('progress_summary').reasoningEffort).toBe('minimal');
  });
});

// ── T4: mapThinking for medium effort on gemini-2.5 family ────────────────────

describe('mapThinking – medium effort on gemini-2.5-flash', () => {
  it('T4: mapThinking("medium", "gemini-2.5-flash") returns thinkingBudget: 8192', () => {
    const result = mapThinking('medium', 'gemini-2.5-flash');
    expect(result).toEqual({ thinkingConfig: { thinkingBudget: 8192 } });
  });

  it('T4b: 8192 is 8× the "low" budget (1024) — confirms the grammar-depth uplift', () => {
    const low = mapThinking('low', 'gemini-2.5-flash');
    const medium = mapThinking('medium', 'gemini-2.5-flash');
    const lowBudget = (low as { thinkingConfig: { thinkingBudget: number } }).thinkingConfig.thinkingBudget;
    const medBudget = (medium as { thinkingConfig: { thinkingBudget: number } }).thinkingConfig.thinkingBudget;
    expect(medBudget).toBe(lowBudget * 8);
  });
});

// ── T5: getFeature throws on unknown slug ─────────────────────────────────────

describe('getFeature', () => {
  it('T5: throws for an unknown feature slug', () => {
    expect(() => getFeature('nonexistent_feature')).toThrow('Unknown feature: nonexistent_feature');
  });

  it('all registered feature slugs are retrievable', () => {
    for (const slug of Object.keys(FEATURES)) {
      expect(() => getFeature(slug)).not.toThrow();
    }
  });
});
