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

const Body = z.object({
  grammarTopicId: z.string().optional(),
  unitId: z.string().optional(),
  count: z.number().int().min(1).max(20).default(5),
  type: z.string().optional(),
  level: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const parsed = Body.safeParse((await req.json().catch(() => null)) ?? {});
    if (!parsed.success) return handleApiError(new ApiError('invalid_input', 'Invalid request', 400));
    const { grammarTopicId, unitId, count, type, level } = parsed.data;

    let scopeType: ScopeType = 'GLOBAL';
    let scopeId: string | null = null;
    if (grammarTopicId) {
      const t = await prisma.grammarTopic.findFirst({ where: { id: grammarTopicId, userId: user.userId }, select: { id: true } });
      if (!t) throw new ApiError('not_found', 'Grammar topic not found', 404);
      scopeType = 'GRAMMAR_TOPIC';
      scopeId = grammarTopicId;
    } else if (unitId) {
      const u = await prisma.unit.findFirst({ where: { id: unitId, course: { userId: user.userId } }, select: { id: true } });
      if (!u) throw new ApiError('not_found', 'Unit not found', 404);
      scopeType = 'UNIT';
      scopeId = unitId;
    }

    const directive =
      `Сгенерируй ${count} упражнений` +
      (type ? ` типа ${type}` : '') +
      (level ? ` уровня ${level}` : ' по моему уровню') +
      '. Включи правильный ответ и краткое объяснение по-русски для каждого. Предложи их как EXERCISE_SET.';

    const thread = await resolveThread(user.userId, scopeType, scopeId);
    const response = await executeCompletion({
      featureSlug: 'exercise_generate',
      userId: user.userId,
      tier: user.tier,
      scopeType,
      scopeId,
      userMessage: directive,
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
        console.error('exercise generate proposal failed:', (e as Error).message);
      }
    }

    return successResponse({ text: response.text, proposals, threadId: thread.id });
  } catch (e) {
    return handleApiError(e);
  }
}
