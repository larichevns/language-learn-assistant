/**
 * DB-driven provider registry + feature router. Loads ProviderConfig, decrypts
 * the API key (or falls back to env GEMINI_API_KEY in dev), and routes a feature
 * to its highest-priority enabled, healthy model.
 */
import { prisma } from '../../db/client';
import { decryptSecret } from '../../encryption';
import type { Pricing } from '../cost';
import type { Provider } from '../types';
import { GeminiProvider } from './gemini';

type ProviderFactory = (apiKey: string, baseUrl?: string) => Provider;

const PROVIDER_CLASSES: Record<string, ProviderFactory> = {
  gemini: (key, baseUrl) => new GeminiProvider(key, baseUrl),
};

export interface RoutedModel {
  provider: Provider;
  providerSlug: string;
  modelId: string;
  pricing?: Pricing;
}

function resolveApiKey(slug: string, apiKeyEncrypted: string | null): string | null {
  if (apiKeyEncrypted) {
    try {
      return decryptSecret(apiKeyEncrypted);
    } catch {
      return null;
    }
  }
  if (slug === 'gemini') return process.env.GEMINI_API_KEY ?? null;
  return null;
}

export async function routeByFeature(featureSlug: string): Promise<RoutedModel> {
  const feature = await prisma.featureFlag.findUnique({
    where: { slug: featureSlug },
    include: {
      routings: {
        where: { isEnabled: true },
        orderBy: { priority: 'desc' },
        include: { model: { include: { provider: true } } },
      },
    },
  });
  if (!feature) throw new Error(`Unknown feature: ${featureSlug}`);

  for (const routing of feature.routings) {
    const model = routing.model;
    const pc = model.provider;
    if (!model.isEnabled || !pc.isEnabled || pc.healthStatus === 'down') continue;
    const factory = PROVIDER_CLASSES[pc.slug];
    if (!factory) continue;
    const apiKey = resolveApiKey(pc.slug, pc.apiKeyEncrypted);
    if (!apiKey) continue;
    return {
      provider: factory(apiKey, pc.baseUrl ?? undefined),
      providerSlug: pc.slug,
      modelId: model.modelId,
      pricing: (model.pricingJson as Pricing | null) ?? undefined,
    };
  }
  throw new Error(`No enabled, healthy model routed for feature: ${featureSlug}`);
}
