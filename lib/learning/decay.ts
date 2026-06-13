/**
 * Forgetting on read. Stored mastery is not trusted at face value: it decays
 * since the last evidence (`masteryUpdatedAt`) by a per-category half-life.
 *   effective = stored * 2^(-Δdays / halfLife)
 * Applied only when SURFACING or RANKING mastery (focus-block, shared layer,
 * nightly rollup) — never written back (a read-time lens; the rollup persists).
 *
 * In the CACHED shared layer mastery is rendered as a quantized BUCKET, so a
 * continuously-drifting % can't bust the prefix cache; the precise decayed
 * value is only surfaced in the volatile focus-block.
 * See vault/specs/phase-5-implementation-plan.md §3.2 / §4.3.
 */
import type { GrammarCategory } from '@prisma/client';

const DAY_MS = 86_400_000;
const DEFAULT_HALF_LIFE_DAYS = 30;
// Per-category tuning hook (well-drilled categories could fade slower).
const HALF_LIFE_DAYS: Partial<Record<GrammarCategory, number>> = {};

export function decayedMastery(
  stored: number,
  masteryUpdatedAt: Date,
  now: Date = new Date(),
  category?: GrammarCategory | null,
): number {
  if (stored <= 0) return 0;
  const halfLife = (category && HALF_LIFE_DAYS[category]) || DEFAULT_HALF_LIFE_DAYS;
  const days = Math.max(0, (now.getTime() - masteryUpdatedAt.getTime()) / DAY_MS);
  return stored * Math.pow(2, -days / halfLife);
}

export type MasteryBucket = 'освоено' | 'закрепляется' | 'учится' | 'слабое';

export function masteryBucket(effective: number): MasteryBucket {
  if (effective >= 0.8) return 'освоено';
  if (effective >= 0.5) return 'закрепляется';
  if (effective >= 0.2) return 'учится';
  return 'слабое';
}

/** A topic still "needs work" when its decayed mastery hasn't reached закрепляется. */
export const NEEDS_WORK_THRESHOLD = 0.5;
