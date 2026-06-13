import type { NextRequest } from 'next/server';
import { ApiError, handleApiError, successResponse } from '@/lib/api/response';
import { requireAdmin } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/client';
import { decryptSecret } from '@/lib/encryption';

const DEFAULT_GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const pc = await prisma.providerConfig.findUnique({ where: { id } });
    if (!pc) throw new ApiError('not_found', 'Provider not found', 404);
    if (pc.slug !== 'gemini') throw new ApiError('invalid_input', `Refresh not implemented for "${pc.slug}"`, 400);

    const key = pc.apiKeyEncrypted ? decryptSecret(pc.apiKeyEncrypted) : process.env.GEMINI_API_KEY;
    if (!key) throw new ApiError('config_error', 'No API key configured', 400);

    const base = (pc.baseUrl ?? DEFAULT_GEMINI_BASE).replace(/\/$/, '');
    const res = await fetch(`${base}/models?pageSize=200`, { headers: { 'x-goog-api-key': key } });
    if (!res.ok) throw new ApiError('upstream', `Gemini models list failed (${res.status})`, 502);
    const data = (await res.json()) as {
      models?: Array<{ name?: string; displayName?: string; supportedGenerationMethods?: string[]; inputTokenLimit?: number }>;
    };

    let upserted = 0;
    for (const m of data.models ?? []) {
      const modelId = m.name?.replace(/^models\//, '');
      if (!modelId || !(m.supportedGenerationMethods ?? []).includes('generateContent')) continue;
      await prisma.modelConfig.upsert({
        where: { providerId_modelId: { providerId: pc.id, modelId } },
        create: {
          providerId: pc.id,
          modelId,
          displayName: m.displayName ?? modelId,
          isEnabled: false,
          contextWindow: m.inputTokenLimit ?? null,
        },
        update: { displayName: m.displayName ?? modelId, contextWindow: m.inputTokenLimit ?? undefined },
      });
      upserted += 1;
    }
    return successResponse({ upserted });
  } catch (e) {
    return handleApiError(e);
  }
}
