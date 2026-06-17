/**
 * Deterministic, character-measured caps (no tokenizer at build time). Mirrors
 * the DB-side caps as a second line of defense. Silent-trim, never reject.
 */
export const CAPS = {
  UNIT: 6000,
  SCOPE: 2500,
  THREAD_SUMMARY: 4000,
  TURN: 2000,
  SHARED: 3000,
  FOCUS: 2000,
  GROUPS: 900, // per-domain group block cap (×3 fits under SHARED 3000); was VOCAB_GROUPS: 1200
} as const;

/** Last N verbatim turns kept in the envelope. */
export const THREAD_TAIL = 12;

export function capText(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + '…';
}

/** Rough token estimate for the priority accumulator (~3 chars/token). */
export function estimateTokens(s: string): number {
  return Math.ceil(s.length / 3);
}
