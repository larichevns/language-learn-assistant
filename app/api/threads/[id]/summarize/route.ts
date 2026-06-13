import type { NextRequest } from 'next/server';
import { ApiError, handleApiError, successResponse } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/client';
import { executeCompletion } from '@/lib/ai/orchestrator';
import { getFeature } from '@/lib/ai/features/templates';
import { interpolate } from '@/lib/ai/prompts/loader';
import { capText } from '@/lib/ai/envelope/caps';

const SUMMARIZE_THRESHOLD = 20;
const KEEP_VERBATIM = 4;

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const thread = await prisma.chatThread.findFirst({ where: { id, userId: user.userId } });
    if (!thread) throw new ApiError('not_found', 'Thread not found', 404);

    const msgs = await prisma.chatMessage.findMany({
      where: { threadId: id, isSummarized: false, role: { in: ['USER', 'ASSISTANT'] } },
      orderBy: { createdAt: 'asc' },
    });
    if (msgs.length < SUMMARIZE_THRESHOLD) {
      return successResponse({ summarized: false, pending: msgs.length });
    }

    const feature = getFeature('thread_summarize');
    const dialogue = msgs.map((m) => `${m.role}: ${m.content}`).join('\n');
    const userPrompt = interpolate(feature.userPromptTemplate ?? '{{dialogue}}', {
      dialogue: capText(dialogue, 12_000),
    });

    const response = await executeCompletion({
      featureSlug: 'thread_summarize',
      userId: user.userId,
      isBackground: true,
      skipRateLimit: true,
      userMessage: '',
      systemOverride: feature.systemPrompt,
      messagesOverride: [{ role: 'user', content: userPrompt }],
    });

    const toSummarize = msgs.slice(0, Math.max(0, msgs.length - KEEP_VERBATIM)).map((m) => m.id);
    await prisma.$transaction([
      prisma.chatThread.update({
        where: { id },
        data: { threadSummary: response.text, summaryWatermark: { increment: toSummarize.length } },
      }),
      prisma.chatMessage.updateMany({ where: { id: { in: toSummarize } }, data: { isSummarized: true } }),
    ]);

    return successResponse({ summarized: true, summarizedCount: toSummarize.length });
  } catch (e) {
    return handleApiError(e);
  }
}
