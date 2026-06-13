import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { ApiError, handleApiError, successResponse } from '@/lib/api/response';
import { requireAdmin } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/client';

const PatchBody = z.object({
  role: z.enum(['USER', 'ADMIN']).optional(),
  tier: z.string().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const parsed = PatchBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return handleApiError(new ApiError('invalid_input', 'Invalid update', 400));

    if (id === admin.userId && parsed.data.role === 'USER') {
      throw new ApiError('conflict', 'Cannot demote yourself', 409);
    }

    const row = await prisma.user.update({
      where: { id },
      data: { role: parsed.data.role, tier: parsed.data.tier },
      select: { id: true, email: true, role: true, tier: true },
    });
    return successResponse(row);
  } catch (e) {
    return handleApiError(e);
  }
}
