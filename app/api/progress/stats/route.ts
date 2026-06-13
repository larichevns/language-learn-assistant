import type { NextRequest } from 'next/server';
import { handleApiError, successResponse } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/client';
import { computeProgressStats } from '@/lib/learning/metrics';

// Derived progress metrics — all computed from the immutable logs, never authored.
// The weekly note (if any) is the nightly rollup's optional LLM summary.
export async function GET(_req: NextRequest) {
  try {
    const user = await requireUser();
    const [stats, profile] = await Promise.all([
      computeProgressStats(user.userId),
      prisma.learnerProfile.findUnique({
        where: { userId: user.userId },
        select: { progressNoteRu: true, progressNoteAt: true },
      }),
    ]);
    return successResponse({
      ...stats,
      weeklyNote: profile?.progressNoteRu ?? null,
      weeklyNoteAt: profile?.progressNoteAt ?? null,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
