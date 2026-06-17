/**
 * Rolling thread summary — the "summarize past a watermark" the architecture
 * promises. When a thread's live (non-summarized) turns grow past SUMMARIZE_AT,
 * fold the older ones — together with the existing summary — into an updated
 * summary and mark them summarized, so the envelope keeps recent turns verbatim
 * PLUS a compressed memory of everything older (instead of silently dropping it
 * once it falls out of the THREAD_TAIL window).
 *
 * Background, non-billed (`isBackground` + `skipRateLimit`), best-effort: the
 * chat route fires it after the response stream closes, and it is self-healing
 * (if a run is skipped, the next turn pushes the count higher and it folds then).
 */
import { prisma } from '../../db/client';
import { CAPS, THREAD_TAIL, capText } from '../envelope/caps';
import { getFeature } from '../features/templates';
import { executeCompletion } from '../orchestrator';
import { interpolate } from '../prompts/loader';

/** Fold once the live turns reach this count… */
export const SUMMARIZE_AT = 24;
/** …keeping the last N verbatim (aligned with the envelope window). */
export const KEEP_VERBATIM = THREAD_TAIL;

export interface SummarizeResult {
  summarized: boolean;
  foldedCount?: number;
  pending?: number;
}

export async function summarizeThreadIfNeeded(threadId: string, userId: string): Promise<SummarizeResult> {
  const thread = await prisma.chatThread.findFirst({ where: { id: threadId, userId } });
  if (!thread) return { summarized: false };

  const msgs = await prisma.chatMessage.findMany({
    where: { threadId, isSummarized: false, role: { in: ['USER', 'ASSISTANT'] } },
    orderBy: { createdAt: 'asc' },
  });
  if (msgs.length < SUMMARIZE_AT) return { summarized: false, pending: msgs.length };

  const fold = msgs.slice(0, Math.max(0, msgs.length - KEEP_VERBATIM));
  if (!fold.length) return { summarized: false, pending: msgs.length };

  const feature = getFeature('thread_summarize');
  const newTurns = fold.map((m) => `${m.role}: ${m.content}`).join('\n');
  const prior = thread.threadSummary?.trim();
  // Feed the existing summary back in so re-summarization consolidates instead of
  // overwriting — earlier context survives across folds.
  const material = prior
    ? `СВОДКА УЖЕ СВЁРНУТЫХ РЕПЛИК:\n${prior}\n\nНОВЫЕ РЕПЛИКИ (добавь в сводку):\n${newTurns}`
    : newTurns;
  const userPrompt = interpolate(feature.userPromptTemplate ?? '{{dialogue}}', {
    dialogue: capText(material, 12_000),
  });

  const response = await executeCompletion({
    featureSlug: 'thread_summarize',
    userId,
    isBackground: true,
    skipRateLimit: true,
    userMessage: '',
    systemOverride: feature.systemPrompt,
    messagesOverride: [{ role: 'user', content: userPrompt }],
  });

  const summary = response.text?.trim();
  if (!summary) return { summarized: false, pending: msgs.length };

  const ids = fold.map((m) => m.id);
  await prisma.$transaction([
    prisma.chatThread.update({
      where: { id: threadId },
      data: { threadSummary: capText(summary, CAPS.THREAD_SUMMARY), summaryWatermark: { increment: ids.length } },
    }),
    prisma.chatMessage.updateMany({ where: { id: { in: ids } }, data: { isSummarized: true } }),
  ]);

  return { summarized: true, foldedCount: ids.length };
}
