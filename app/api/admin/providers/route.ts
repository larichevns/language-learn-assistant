import { Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { ApiError, handleApiError, successResponse } from '@/lib/api/response';
import { requireAdmin } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/client';
import { encryptSecret } from '@/lib/encryption';

export async function GET() {
  try {
    await requireAdmin();
    const providers = await prisma.providerConfig.findMany({
      orderBy: { priority: 'desc' },
      include: { models: { select: { id: true, modelId: true, displayName: true, isEnabled: true } } },
    });
    // Redact secrets: expose only whether a key is stored.
    const redacted = providers.map(({ apiKeyEncrypted, ...rest }) => ({ ...rest, hasKey: Boolean(apiKeyEncrypted) }));
    return successResponse(redacted);
  } catch (e) {
    return handleApiError(e);
  }
}

const CreateBody = z.object({
  slug: z.string().regex(/^[a-z0-9_-]+$/),
  displayName: z.string(),
  baseUrl: z.string().url().optional(),
  apiKey: z.string().optional(),
  isEnabled: z.boolean().optional(),
  capabilitiesJson: z.unknown().optional(),
  priority: z.number().int().optional(),
});

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const parsed = CreateBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return handleApiError(new ApiError('invalid_input', 'Invalid provider', 400));
    const d = parsed.data;

    let apiKeyEncrypted: string | undefined;
    if (d.apiKey) {
      if (!process.env.ENCRYPTION_KEY) throw new ApiError('config_error', 'ENCRYPTION_KEY not configured', 400);
      apiKeyEncrypted = encryptSecret(d.apiKey);
    }

    const row = await prisma.providerConfig.create({
      data: {
        slug: d.slug,
        displayName: d.displayName,
        baseUrl: d.baseUrl,
        apiKeyEncrypted,
        isEnabled: d.isEnabled ?? false,
        capabilitiesJson: (d.capabilitiesJson ?? undefined) as Prisma.InputJsonValue | undefined,
        priority: d.priority ?? 0,
      },
    });
    return successResponse({ id: row.id, slug: row.slug, hasKey: Boolean(apiKeyEncrypted) }, 201);
  } catch (e) {
    return handleApiError(e);
  }
}
