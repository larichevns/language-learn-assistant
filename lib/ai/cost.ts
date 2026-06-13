/**
 * Cost estimation from a model's pricing (USD per 1M tokens) and token usage.
 * Cached input is billed at the cache-read rate; the rest of input at the input
 * rate. Free-tier usage is $0, but we still track estimated cost for dashboards.
 */
import type { Usage } from './types';

export interface Pricing {
  /** USD per 1M tokens */
  input?: number;
  output?: number;
  cacheRead?: number;
  cacheCreate?: number;
}

export function calculateCost(pricing: Pricing, usage: Usage): number {
  const per = (tokens: number, rate?: number): number =>
    rate ? (tokens / 1_000_000) * rate : 0;

  const billedInput = Math.max(0, usage.inputTokens - usage.cachedTokens);
  return (
    per(billedInput, pricing.input) +
    per(usage.cachedTokens, pricing.cacheRead) +
    per(usage.outputTokens, pricing.output)
  );
}
