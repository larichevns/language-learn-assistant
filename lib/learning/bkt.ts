/**
 * Bayesian Knowledge Tracing — one mastery slot p(L) per skill, updated from
 * each correct/incorrect observation. Fixed params (single learner, sparse
 * data → no per-skill fit): treat the output as a SMOOTHED SIGNAL, not truth.
 * See vault/specs/phase-5-implementation-plan.md §3.1.
 */
export const BKT_PARAMS = { G: 0.2, S: 0.1, T: 0.15, L0: 0.1 } as const;

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

/**
 * Update p(L) from one observation.
 * `prior <= 0` is treated as "unseen" and starts from the prior L0.
 */
export function bktUpdate(prior: number, correct: boolean, p = BKT_PARAMS): number {
  const pL = prior > 0 ? clamp01(prior) : p.L0;
  const posterior = correct
    ? (pL * (1 - p.S)) / (pL * (1 - p.S) + (1 - pL) * p.G)
    : (pL * p.S) / (pL * p.S + (1 - pL) * (1 - p.G));
  return clamp01(posterior + (1 - posterior) * p.T);
}
