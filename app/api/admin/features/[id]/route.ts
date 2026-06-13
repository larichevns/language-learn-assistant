import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { ApiError, handleApiError, successResponse } from '@/lib/api/response';
import { requireAdmin } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/client';

const PatchBody = z.object({
  name: z.string().optional(),
  description: z.string().nullish(),
  category: z.string().nullish(),
  isActive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const parsed = PatchBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return handleApiError(new ApiError('invalid_input', 'Invalid update', 400));
    const d = parsed.data;
    const row = await prisma.featureFlag.update({
      where: { id },
      data: {
        name: d.name ?? undefined,
        description: d.description ?? undefined,
        category: d.category ?? undefined,
        isActive: d.isActive ?? undefined,
      },
    });
    return successResponse(row);
  } catch (e) {
    return handleApiError(e);
  }
}
