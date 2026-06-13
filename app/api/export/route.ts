import type { NextRequest } from 'next/server';
import { handleApiError } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/guards';
import { buildFullExport, buildRevlogCsv, buildVocabCsv } from '@/lib/export';

function download(body: string, filename: string, contentType: string): Response {
  return new Response(body, {
    headers: {
      'content-type': contentType,
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
    },
  });
}

// One-click export of the learner's own data. format = json | vocab-csv | revlog-csv.
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const format = new URL(req.url).searchParams.get('format') ?? 'json';
    const stamp = new Date().toISOString().slice(0, 10);

    if (format === 'vocab-csv') {
      return download(await buildVocabCsv(user.userId), `lla-vocab-${stamp}.csv`, 'text/csv; charset=utf-8');
    }
    if (format === 'revlog-csv') {
      return download(await buildRevlogCsv(user.userId), `lla-revlog-${stamp}.csv`, 'text/csv; charset=utf-8');
    }
    const dump = await buildFullExport(user.userId);
    return download(JSON.stringify(dump, null, 2), `lla-export-${stamp}.json`, 'application/json; charset=utf-8');
  } catch (e) {
    return handleApiError(e);
  }
}
