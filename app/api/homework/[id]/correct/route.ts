import type { NextRequest } from 'next/server';
import { ApiError, handleApiError, successResponse } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/client';
import { executeCompletion } from '@/lib/ai/orchestrator';
import { persistProposal } from '@/lib/ai/propose/persist';
import { proposeToolDecl } from '@/lib/ai/propose/tool';
import { resolveThread } from '@/lib/ai/thread/service';

/** Run the AI homework correction: one correction proposal per mistake. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const hw = await prisma.homework.findFirst({ where: { id, userId: user.userId } });
    if (!hw) throw new ApiError('not_found', 'Homework not found', 404);

    // Vision: if the homework is a photo, attach the image bytes to the message.
    let images: Array<{ mimeType: string; dataBase64: string }> | undefined;
    if (hw.source === 'IMAGE' && hw.imageUrl?.startsWith('data:')) {
      const m = /^data:([^;]+);base64,(.+)$/.exec(hw.imageUrl);
      if (m && m[1] && m[2]) images = [{ mimeType: m[1], dataBase64: m[2] }];
    }

    const thread = await resolveThread(user.userId, 'HOMEWORK', id);

    const response = await executeCompletion({
      featureSlug: 'homework_correct',
      userId: user.userId,
      tier: user.tier,
      scopeType: 'HOMEWORK',
      scopeId: id,
      userMessage: images
        ? 'Прочитай текст домашнего задания с фото, затем исправь каждую ошибку и объясни её по-русски.'
        : 'Проверь это домашнее задание: исправь каждую ошибку и объясни её по-русски.',
      images,
      tools: [proposeToolDecl],
      toolChoice: 'auto',
    });

    const proposals = [];
    for (const call of response.toolCalls) {
      if (call.name !== 'propose') continue;
      try {
        const p = await persistProposal({ userId: user.userId, threadId: thread.id, call });
        proposals.push({
          id: p.id,
          targetType: p.targetType,
          op: p.op,
          targetId: p.targetId,
          summary: p.summary,
          payload: p.payloadJson,
          status: p.status,
        });
      } catch (e) {
        // skip a malformed proposal but keep going
        console.error('homework correct proposal failed:', (e as Error).message);
      }
    }

    return successResponse({ text: response.text, proposals, threadId: thread.id });
  } catch (e) {
    return handleApiError(e);
  }
}
