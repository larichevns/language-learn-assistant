import type { ScopeType } from '@prisma/client';
import type { NextRequest } from 'next/server';
import { handleApiError, successResponse } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/client';
import { resolveThread } from '@/lib/ai/thread/service';

const SCOPE_TYPES = [
  'GLOBAL', 'COURSE', 'UNIT', 'VOCAB_ENTRY', 'VOCAB_LIST', 'GRAMMAR_TOPIC', 'HOMEWORK', 'CLASS_NOTE', 'EXERCISE_SET',
];

/** Get-or-create the thread for a scope and return its recent turns + pending proposals. */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const scopeTypeRaw = url.searchParams.get('scopeType') ?? 'GLOBAL';
    const scopeType = (SCOPE_TYPES.includes(scopeTypeRaw) ? scopeTypeRaw : 'GLOBAL') as ScopeType;
    const scopeId = url.searchParams.get('scopeId') || null;

    const thread = await resolveThread(user.userId, scopeType, scopeId);

    const [rows, proposals] = await Promise.all([
      prisma.chatMessage.findMany({
        where: { threadId: thread.id, isSummarized: false, role: { in: ['USER', 'ASSISTANT'] } },
        orderBy: { createdAt: 'desc' },
        take: 24,
      }),
      prisma.proposal.findMany({
        where: { threadId: thread.id, status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    return successResponse({
      threadId: thread.id,
      summary: thread.threadSummary,
      messages: rows
        .reverse()
        .map((r) => ({ role: r.role === 'ASSISTANT' ? 'assistant' : 'user', content: r.content })),
      proposals: proposals.map((p) => ({
        id: p.id,
        targetType: p.targetType,
        op: p.op,
        targetId: p.targetId,
        summary: p.summary,
        payload: p.payloadJson,
        status: p.status,
      })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}
