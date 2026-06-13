import type { NextRequest } from 'next/server';
import { errorResponse, handleApiError, successResponse } from '@/lib/api/response';
import { prisma } from '@/lib/db/client';

/** Periodic cleanup. Gated by CRON_SECRET (header x-cron-secret or ?secret=). */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const secret = req.headers.get('x-cron-secret') ?? url.searchParams.get('secret');
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
      return errorResponse('forbidden', 'Invalid cron secret', 403);
    }

    const cutoff = new Date(Date.now() - 30 * 86_400_000);
    const proposals = await prisma.proposal.deleteMany({
      where: { status: { in: ['DISCARDED', 'SUPERSEDED'] }, createdAt: { lt: cutoff } },
    });
    const errorLogs = await prisma.usageEvent.deleteMany({
      where: { status: 'error', createdAt: { lt: new Date(Date.now() - 90 * 86_400_000) } },
    });

    return successResponse({ prunedProposals: proposals.count, prunedErrorLogs: errorLogs.count });
  } catch (e) {
    return handleApiError(e);
  }
}
