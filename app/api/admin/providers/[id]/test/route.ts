import type { NextRequest } from 'next/server';
import { ApiError, handleApiError, successResponse } from '@/lib/api/response';
import { requireAdmin } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/client';
import { decryptSecret } from '@/lib/encryption';
import { GeminiProvider } from '@/lib/ai/providers/gemini';

function resolveKey(slug: string, apiKeyEncrypted: string | null): string | null {
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

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const pc = await prisma.providerConfig.findUnique({ where: { id } });
    if (!pc) throw new ApiError('not_found', 'Provider not found', 404);

    const key = resolveKey(pc.slug, pc.apiKeyEncrypted);
    let ok = false;
    let detail: string | undefined;

    if (!key) {
      detail = 'No API key configured';
    } else if (pc.slug === 'gemini') {
      const provider = new GeminiProvider(key, pc.baseUrl ?? undefined);
      const h = await provider.healthCheck();
      ok = h.ok;
      detail = h.detail;
    } else {
      detail = `Health check not implemented for provider "${pc.slug}"`;
    }

    await prisma.providerConfig.update({
      where: { id },
      data: { healthStatus: ok ? 'up' : 'down', healthCheckedAt: new Date() },
    });
    return successResponse({ ok, detail });
  } catch (e) {
    return handleApiError(e);
  }
}
