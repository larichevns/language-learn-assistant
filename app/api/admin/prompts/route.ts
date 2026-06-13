import { Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { ApiError, handleApiError, successResponse } from '@/lib/api/response';
import { requireAdmin } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/client';

export async function GET(req: NextRequest) {
  try {
    await requireAdmin();
    const featureId = new URL(req.url).searchParams.get('featureId') ?? undefined;
    const templates = await prisma.promptTemplate.findMany({
      where: featureId ? { featureId } : {},
      orderBy: [{ featureId: 'asc' }, { promptType: 'asc' }, { version: 'desc' }],
      include: { feature: { select: { slug: true, name: true } } },
    });
    return successResponse(templates);
  } catch (e) {
    return handleApiError(e);
  }
}

const CreateBody = z.object({
  featureId: z.string(),
  promptType: z.string().default('default'),
  systemPrompt: z.string(),
  userPromptTemplate: z.string(),
  variablesJson: z.unknown().optional(),
  parametersJson: z.unknown().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    const parsed = CreateBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return handleApiError(new ApiError('invalid_input', 'Invalid template', 400));
    const d = parsed.data;

    const feature = await prisma.featureFlag.findUnique({ where: { id: d.featureId }, select: { id: true } });
    if (!feature) throw new ApiError('not_found', 'Feature not found', 404);

    const last = await prisma.promptTemplate.findFirst({
      where: { featureId: d.featureId, promptType: d.promptType },
      orderBy: { version: 'desc' },
      select: { version: true },
    });

    const row = await prisma.promptTemplate.create({
      data: {
        featureId: d.featureId,
        promptType: d.promptType,
        version: (last?.version ?? 0) + 1,
        systemPrompt: d.systemPrompt,
        userPromptTemplate: d.userPromptTemplate,
        variablesJson: (d.variablesJson ?? undefined) as Prisma.InputJsonValue | undefined,
        parametersJson: (d.parametersJson ?? undefined) as Prisma.InputJsonValue | undefined,
        isActive: false,
        createdBy: admin.userId,
      },
    });
    return successResponse(row, 201);
  } catch (e) {
    return handleApiError(e);
  }
}
