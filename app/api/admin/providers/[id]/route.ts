import { Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { ApiError, handleApiError, successResponse } from '@/lib/api/response';
import { requireAdmin } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/client';
import { encryptSecret } from '@/lib/encryption';

const PatchBody = z.object({
  displayName: z.string().optional(),
  baseUrl: z.string().url().nullish(),
  apiKey: z.string().optional(),
  isEnabled: z.boolean().optional(),
  capabilitiesJson: z.unknown().optional(),
  priority: z.number().int().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const parsed = PatchBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return handleApiError(new ApiError('invalid_input', 'Invalid update', 400));
    const d = parsed.data;

    let apiKeyEncrypted: string | undefined;
    if (d.apiKey) {
      if (!process.env.ENCRYPTION_KEY) throw new ApiError('config_error', 'ENCRYPTION_KEY not configured', 400);
      apiKeyEncrypted = encryptSecret(d.apiKey);
    }

    const row = await prisma.providerConfig.update({
      where: { id },
      data: {
        displayName: d.displayName ?? undefined,
        baseUrl: d.baseUrl ?? undefined,
        apiKeyEncrypted,
        isEnabled: d.isEnabled ?? undefined,
        capabilitiesJson: (d.capabilitiesJson ?? undefined) as Prisma.InputJsonValue | undefined,
        priority: d.priority ?? undefined,
      },
    });
    return successResponse({ id: row.id, slug: row.slug, isEnabled: row.isEnabled, hasKey: Boolean(row.apiKeyEncrypted) });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    await prisma.providerConfig.delete({ where: { id } });
    return successResponse({ id, deleted: true });
  } catch (e) {
    return handleApiError(e);
  }
}
