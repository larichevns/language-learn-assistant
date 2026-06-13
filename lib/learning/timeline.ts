/**
 * Timeline journal — append-only projection of milestone events. Written inside
 * the caller's transaction at the moment the milestone happens (card matured,
 * homework corrected, …). Read back as a feed on /progress.
 * See vault/specs/phase-5-implementation-plan.md §6.1.
 */
import type { Prisma, TimelineEventType } from '@prisma/client';

type Tx = Prisma.TransactionClient;

export async function emitTimelineEvent(
  tx: Tx,
  e: { userId: string; type: TimelineEventType; refType?: string | null; refId?: string | null; payload?: unknown },
): Promise<void> {
  await tx.timelineEvent.create({
    data: {
      userId: e.userId,
      type: e.type,
      refType: e.refType ?? null,
      refId: e.refId ?? null,
      payloadJson: (e.payload ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}
