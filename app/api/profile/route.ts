import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { ApiError, handleApiError, successResponse } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/client';

// Learner profile read/update. Currently exposes the FSRS desired-retention
// target; extend the schema as more editable preferences land.
export async function GET(_req: NextRequest) {
  try {
    const user = await requireUser();
    const profile = await prisma.learnerProfile.findUnique({
      where: { userId: user.userId },
      select: { desiredRetention: true, cefrLevel: true, nativeLang: true, targetLang: true },
    });
    if (!profile) throw new ApiError('not_found', 'Profile not found', 404);
    return successResponse(profile);
  } catch (e) {
    return handleApiError(e);
  }
}

const PatchSchema = z.object({
  // FSRS request_retention — keep it in a sane band; 0.9 is the default.
  desiredRetention: z.number().min(0.8).max(0.98).optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser();
    const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ApiError('invalid_input', 'Invalid profile update', 400);

    const updated = await prisma.learnerProfile.update({
      where: { userId: user.userId },
      data: { desiredRetention: parsed.data.desiredRetention },
      select: { desiredRetention: true },
    });
    return successResponse(updated);
  } catch (e) {
    return handleApiError(e);
  }
}
