/**
 * Usage metering. Idempotent on requestId. Background ops never bill (cost = 0).
 */
import { prisma } from '../../db/client';
import { calculateCost, type Pricing } from '../cost';
import type { Usage } from '../types';

export interface LogUsageInput {
  userId?: string | null;
  requestId?: string;
  featureSlug: string;
  operationType?: string;
  providerSlug?: string;
  modelId?: string;
  usage: Usage;
  pricing?: Pricing;
  status?: 'ok' | 'error';
  errorMessage?: string;
  latencyMs?: number;
  isBackground?: boolean;
}

export async function logUsage(input: LogUsageInput) {
  if (input.requestId) {
    const existing = await prisma.usageEvent.findFirst({ where: { requestId: input.requestId } });
    if (existing) return existing;
  }
  const cost = input.isBackground || !input.pricing ? 0 : calculateCost(input.pricing, input.usage);

  return prisma.usageEvent.create({
    data: {
      userId: input.userId ?? null,
      requestId: input.requestId,
      featureSlug: input.featureSlug,
      operationType: input.operationType ?? 'text_completion',
      providerSlug: input.providerSlug,
      modelId: input.modelId,
      inputTokens: input.usage.inputTokens,
      outputTokens: input.usage.outputTokens,
      cachedTokens: input.usage.cachedTokens,
      thinkingTokens: input.usage.thinkingTokens,
      estimatedCostUsd: cost,
      status: input.status ?? 'ok',
      errorMessage: input.errorMessage,
      latencyMs: input.latencyMs,
      isBackground: input.isBackground ?? false,
    },
  });
}
