import type { NextRequest } from 'next/server';
import { errorResponse, handleApiError, successResponse } from '@/lib/api/response';
import { runRollup } from '@/lib/learning/rollup';

/**
 * Nightly rollup. Recomputes derived weakAreasJson from logs+decay, emits
 * milestone events, and writes an optional weekly note. Gated by CRON_SECRET
 * (header x-cron-secret or ?secret=), like crons/cleanup. Point an external
 * scheduler at it once daily.
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const secret = req.headers.get('x-cron-secret') ?? url.searchParams.get('secret');
    if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
      return errorResponse('forbidden', 'Invalid cron secret', 403);
    }

    const summary = await runRollup();
    return successResponse(summary);
  } catch (e) {
    return handleApiError(e);
  }
}
