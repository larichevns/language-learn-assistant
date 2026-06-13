import { type HomeworkSource, Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { ApiError, handleApiError, successResponse } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/guards';
import { listResult, parsePagination } from '@/lib/api/pagination';
import { prisma } from '@/lib/db/client';

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const url = new URL(req.url);
    const p = parsePagination(url);
    const where: Prisma.HomeworkWhereInput = { userId: user.userId };
    const [items, total] = await Promise.all([
      prisma.homework.findMany({ where, orderBy: { updatedAt: 'desc' }, skip: p.skip, take: p.take }),
      prisma.homework.count({ where }),
    ]);
    return successResponse(listResult(items, total, p));
  } catch (e) {
    return handleApiError(e);
  }
}

const CreateBody = z
  .object({
    title: z.string().max(200).optional(),
    rawInput: z.string().max(20_000).optional(),
    source: z.enum(['TEXT', 'IMAGE', 'VOICE']).optional(),
    // data: URL or http(s) URL — a pasted photo is a data URL
    imageUrl: z.string().max(8_000_000).optional(),
  })
  .refine((b) => (b.rawInput && b.rawInput.trim().length > 0) || Boolean(b.imageUrl), {
    message: 'rawInput or imageUrl required',
  });

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const parsed = CreateBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return handleApiError(new ApiError('invalid_input', 'Invalid homework', 400));
    const d = parsed.data;
    const course = await prisma.course.findFirst({ where: { userId: user.userId, isActive: true }, select: { id: true } });
    const row = await prisma.homework.create({
      data: {
        userId: user.userId,
        courseId: course?.id ?? null,
        title: d.title,
        rawInput: d.rawInput?.trim() || '(фото-домашка)',
        source: (d.source ?? (d.imageUrl ? 'IMAGE' : 'TEXT')) as HomeworkSource,
        imageUrl: d.imageUrl,
        status: 'SUBMITTED',
      },
    });
    return successResponse(row, 201);
  } catch (e) {
    return handleApiError(e);
  }
}
