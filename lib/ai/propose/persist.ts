/**
 * Persist a `propose` tool call as a PENDING Proposal row. The card survives
 * reload and is an audit trail; it is NOT part of the next envelope until Applied.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../db/client';
import type { ToolCall } from '../types';
import { parseProposeCall } from './dispatch';

export async function persistProposal(opts: {
  userId: string;
  threadId?: string | null;
  call: ToolCall;
}) {
  const parsed = parseProposeCall(opts.call);
  return prisma.proposal.create({
    data: {
      userId: opts.userId,
      threadId: opts.threadId ?? null,
      targetType: parsed.targetType,
      targetId: parsed.targetId ?? null,
      op: parsed.op,
      summary: parsed.summary,
      payloadJson: (parsed.payload ?? {}) as Prisma.InputJsonValue,
      status: 'PENDING',
    },
  });
}
