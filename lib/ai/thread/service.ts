/**
 * Chat thread helpers: one thread per (user, scopeType, scopeId). The chat route
 * resolves the thread, loads the verbatim tail, and appends turns. The envelope
 * is rebuilt from the DB each send — the thread is just storage.
 */
import { type ChatRole, Prisma, type ScopeType } from '@prisma/client';
import { prisma } from '../../db/client';
import { THREAD_TAIL } from '../envelope/caps';
import type { Message } from '../types';

export async function resolveThread(userId: string, scopeType: ScopeType, scopeId: string | null) {
  const existing = await prisma.chatThread.findFirst({ where: { userId, scopeType, scopeId } });
  if (existing) return existing;
  return prisma.chatThread.create({ data: { userId, scopeType, scopeId } });
}

export async function loadHistory(threadId: string, take: number = THREAD_TAIL): Promise<Message[]> {
  const rows = await prisma.chatMessage.findMany({
    where: { threadId, isSummarized: false, role: { in: ['USER', 'ASSISTANT'] } },
    orderBy: { createdAt: 'desc' },
    take,
  });
  return rows
    .reverse()
    .map((r) => ({ role: r.role === 'ASSISTANT' ? ('model' as const) : ('user' as const), content: r.content }));
}

export async function appendMessage(threadId: string, role: ChatRole, content: string, metaJson?: unknown) {
  return prisma.chatMessage.create({
    data: {
      threadId,
      role,
      content,
      metaJson: metaJson == null ? undefined : (metaJson as Prisma.InputJsonValue),
    },
  });
}
