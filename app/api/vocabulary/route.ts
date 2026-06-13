import { type CefrLevel, type PartOfSpeech, Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';
import { ApiError, handleApiError, successResponse } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/guards';
import { listResult, parsePagination } from '@/lib/api/pagination';
import { prisma } from '@/lib/db/client';
import { VocabEntryPayload } from '@/lib/ai/propose/tool';

const json = (v: unknown): Prisma.InputJsonValue | undefined =>
  v == null ? undefined : (v as Prisma.InputJsonValue);

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const p = parsePagination(url);
    const pos = url.searchParams.get('pos');
    const q = url.searchParams.get('q');

    const where: Prisma.VocabEntryWhereInput = {
      userId: user.userId,
      ...(pos ? { pos: pos as PartOfSpeech } : {}),
      ...(q
        ? {
            OR: [
              { lemma: { contains: q, mode: 'insensitive' } },
              { translationRu: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.vocabEntry.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: p.skip,
        take: p.take,
        include: { srsCards: { select: { state: true, dueAt: true, direction: true } } },
      }),
      prisma.vocabEntry.count({ where }),
    ]);

    return successResponse(listResult(items, total, p));
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const parsed = VocabEntryPayload.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return handleApiError(new ApiError('invalid_input', 'Invalid vocab entry', 400));
    const v = parsed.data;

    const data = {
      translationRu: v.translationRu,
      gender: v.gender ?? null,
      pluralForm: v.pluralForm ?? null,
      genitiveForm: v.genitiveForm ?? null,
      isSeparable: v.isSeparable ?? null,
      separablePrefix: v.separablePrefix ?? null,
      auxiliary: v.auxiliary ?? null,
      partizipII: v.partizipII ?? null,
      praeteritum: v.praeteritum ?? null,
      presentIrregular: v.presentIrregular ?? null,
      isReflexive: v.isReflexive ?? null,
      governsCase: v.governsCase ?? null,
      cefrLevel: (v.cefrLevel ?? null) as CefrLevel | null,
      examplesJson: json(v.examples),
      tagsJson: json(v.tags),
    };

    const row = await prisma.vocabEntry.upsert({
      where: { userId_lemma_pos: { userId: user.userId, lemma: v.lemma, pos: v.pos as PartOfSpeech } },
      create: { userId: user.userId, lemma: v.lemma, pos: v.pos as PartOfSpeech, ...data },
      update: data,
    });
    return successResponse(row, 201);
  } catch (e) {
    return handleApiError(e);
  }
}
