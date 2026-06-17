import type { ScopeType } from '@prisma/client';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { ApiError, handleApiError } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/guards';
import { streamCompletion } from '@/lib/ai/orchestrator';
import { persistProposal } from '@/lib/ai/propose/persist';
import { proposeToolDecl } from '@/lib/ai/propose/tool';
import { appendMessage, loadHistory, resolveThread } from '@/lib/ai/thread/service';
import { summarizeThreadIfNeeded } from '@/lib/ai/thread/summarize';
import type { ToolCall } from '@/lib/ai/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const SCOPE_TYPES = [
  'GLOBAL',
  'COURSE',
  'UNIT',
  'VOCAB_ENTRY',
  'VOCAB_LIST',
  'GRAMMAR_TOPIC',
  'HOMEWORK',
  'CLASS_NOTE',
  'EXERCISE_SET',
] as const;

const Body = z.object({
  message: z.string().min(1).max(8000),
  scopeType: z.enum(SCOPE_TYPES).default('GLOBAL'),
  scopeId: z.string().nullish(),
  feature: z.string().default('tutor_chat'),
});

export async function POST(req: NextRequest) {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    return handleApiError(e);
  }

  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) return handleApiError(new ApiError('invalid_input', 'Invalid request body', 400));
  const { message, scopeType, scopeId, feature } = parsed.data;

  const thread = await resolveThread(user.userId, scopeType as ScopeType, scopeId ?? null);
  const history = await loadHistory(thread.id);
  await appendMessage(thread.id, 'USER', message);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));

      let assistantText = '';
      const toolCalls: ToolCall[] = [];
      let failed = false;
      try {
        for await (const chunk of streamCompletion({
          featureSlug: feature,
          userId: user.userId,
          tier: user.tier,
          scopeType: scopeType as ScopeType,
          scopeId: scopeId ?? null,
          userMessage: message,
          history,
          threadSummary: thread.threadSummary,
          tools: [proposeToolDecl],
          toolChoice: 'auto',
          signal: req.signal,
        })) {
          if (chunk.textDelta) {
            assistantText += chunk.textDelta;
            send('token', { text: chunk.textDelta });
          }
          if (chunk.toolCall) toolCalls.push(chunk.toolCall);
          if (chunk.usage) send('usage', chunk.usage);
          if (chunk.finishReason) send('finish', { reason: chunk.finishReason });
        }
      } catch (e) {
        failed = true;
        // Client Stop / disconnect aborts req.signal — that's a graceful stop, not
        // an error worth surfacing (the client is already gone).
        if (!req.signal.aborted) {
          if (e instanceof ApiError) {
            send('error', { code: e.code, message: e.message, status: e.status, retryAfter: e.headers?.['Retry-After'] });
          } else {
            send('error', { message: (e as Error).message });
          }
        }
      }

      // Persist the assistant turn only when it carries text — including a partial
      // answer cut short by Stop/timeout. An empty turn would leave the user turn
      // dangling and the next send would answer the stale question first.
      if (assistantText.trim()) {
        await appendMessage(thread.id, 'ASSISTANT', assistantText, {
          tools: toolCalls.map((t) => t.name),
        }).catch(() => {});
      }

      if (!failed) {
        for (const call of toolCalls) {
          if (call.name !== 'propose') continue;
          try {
            const proposal = await persistProposal({ userId: user.userId, threadId: thread.id, call });
            send('proposal', {
              id: proposal.id,
              targetType: proposal.targetType,
              op: proposal.op,
              targetId: proposal.targetId,
              summary: proposal.summary,
              payload: proposal.payloadJson,
              status: proposal.status,
            });
          } catch (e) {
            send('error', { message: `proposal: ${(e as Error).message}` });
          }
        }
        send('done', { threadId: thread.id });
      }

      try {
        controller.close();
      } catch {
        /* already closed by the client's abort */
      }

      // Rolling summary: fold turns older than the window into threadSummary so a
      // long thread keeps its early context instead of silently dropping it. Runs
      // after the response stream has closed — background, non-billed, best-effort.
      if (!failed) {
        await summarizeThreadIfNeeded(thread.id, user.userId).catch(() => {});
      }
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
    },
  });
}
