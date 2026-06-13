import { type CefrLevel, type GrammarCategory, Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';
import { ApiError, handleApiError, successResponse } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/guards';
import { listResult, parsePagination } from '@/lib/api/pagination';
import { prisma } from '@/lib/db/client';
import { GrammarTopicPayload } from '@/lib/ai/propose/tool';

const json = (v: unknown): Prisma.InputJsonValue | undefined =>
  v == null ? undefined : (v as Prisma.InputJsonValue);

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const p = parsePagination(url);
    const category = url.searchParams.get('category');
    const q = url.searchParams.get('q');
    const where: Prisma.GrammarTopicWhereInput = {
      userId: user.userId,
      ...(category ? { category: category as GrammarCategory } : {}),
      ...(q ? { title: { contains: q, mode: 'insensitive' } } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.grammarTopic.findMany({ where, orderBy: { updatedAt: 'desc' }, skip: p.skip, take: p.take }),
      prisma.grammarTopic.count({ where }),
    ]);
    return successResponse(listResult(items, total, p));
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const parsed = GrammarTopicPayload.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return handleApiError(new ApiError('invalid_input', 'Invalid grammar topic', 400));
    const g = parsed.data;
    const unit = await prisma.unit.findFirst({ where: { course: { userId: user.userId }, isCurrent: true }, select: { id: true } });
    const row = await prisma.grammarTopic.create({
      data: {
        userId: user.userId,
        unitId: unit?.id ?? null,
        title: g.title,
        category: g.category as GrammarCategory,
        cefrLevel: (g.cefrLevel ?? null) as CefrLevel | null,
        explanationRu: g.explanationRu,
        examplesJson: json(g.examples),
        rulesJson: json(g.rules),
        pitfallsJson: json(g.pitfalls),
      },
    });
    return successResponse(row, 201);
  } catch (e) {
    return handleApiError(e);
  }
}
