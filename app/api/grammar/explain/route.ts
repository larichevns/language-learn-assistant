import type { ScopeType } from '@prisma/client';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { ApiError, handleApiError, successResponse } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/client';
import { executeCompletion } from '@/lib/ai/orchestrator';
import { persistProposal } from '@/lib/ai/propose/persist';
import { proposeToolDecl } from '@/lib/ai/propose/tool';
import { resolveThread } from '@/lib/ai/thread/service';

const Body = z
  .object({
    topic: z.string().min(1).max(200).optional(),
    grammarTopicId: z.string().optional(),
    question: z.string().max(2000).optional(),
    level: z.string().optional(),
  })
  .refine((b) => b.topic || b.grammarTopicId || b.question, { message: 'topic, grammarTopicId or question required' });

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return handleApiError(new ApiError('invalid_input', 'Invalid request', 400));
    const { topic, grammarTopicId, question, level } = parsed.data;

    let scopeType: ScopeType = 'GLOBAL';
    let scopeId: string | null = null;
    if (grammarTopicId) {
      const t = await prisma.grammarTopic.findFirst({ where: { id: grammarTopicId, userId: user.userId }, select: { id: true } });
      if (!t) throw new ApiError('not_found', 'Grammar topic not found', 404);
      scopeType = 'GRAMMAR_TOPIC';
      scopeId = grammarTopicId;
    }

    const userMessage =
      question ??
      `Объясни грамматическую тему: ${topic ?? 'тема в контексте'}${level ? ` (уровень ${level})` : ''}. Приведи примеры и подводные камни для русскоязычных. Предложи сохранить как GRAMMAR_TOPIC.`;

    const thread = await resolveThread(user.userId, scopeType, scopeId);
    const response = await executeCompletion({
      featureSlug: 'grammar_explain',
      userId: user.userId,
      tier: user.tier,
      scopeType,
      scopeId,
      userMessage,
      tools: [proposeToolDecl],
      toolChoice: 'auto',
    });

    const proposals = [];
    for (const call of response.toolCalls) {
      if (call.name !== 'propose') continue;
      try {
        const p = await persistProposal({ userId: user.userId, threadId: thread.id, call });
        proposals.push({ id: p.id, targetType: p.targetType, summary: p.summary, payload: p.payloadJson, status: p.status });
      } catch (e) {
        console.error('grammar explain proposal failed:', (e as Error).message);
      }
    }

    return successResponse({ text: response.text, proposals, threadId: thread.id });
  } catch (e) {
    return handleApiError(e);
  }
}
