import { Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { ApiError, handleApiError, successResponse } from '@/lib/api/response';
import { requireAdmin } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/client';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const routings = await prisma.modelRouting.findMany({
      where: { featureId: id },
      orderBy: { priority: 'desc' },
      include: { model: { include: { provider: { select: { slug: true, displayName: true, healthStatus: true } } } } },
    });
    return successResponse(routings);
  } catch (e) {
    return handleApiError(e);
  }
}

const PutBody = z.object({
  routings: z
    .array(
      z.object({
        modelId: z.string(),
        priority: z.number().int().default(0),
        isEnabled: z.boolean().default(true),
        configOverrideJson: z.unknown().optional(),
      }),
    )
    .min(1),
});

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    const parsed = PutBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return handleApiError(new ApiError('invalid_input', 'Invalid routing', 400));

    await prisma.$transaction(
      parsed.data.routings.map((r) =>
        prisma.modelRouting.upsert({
          where: { featureId_modelId: { featureId: id, modelId: r.modelId } },
          create: {
            featureId: id,
            modelId: r.modelId,
            priority: r.priority,
            isEnabled: r.isEnabled,
            configOverrideJson: (r.configOverrideJson ?? undefined) as Prisma.InputJsonValue | undefined,
          },
          update: {
            priority: r.priority,
            isEnabled: r.isEnabled,
            configOverrideJson: (r.configOverrideJson ?? undefined) as Prisma.InputJsonValue | undefined,
          },
        }),
      ),
    );
    const routings = await prisma.modelRouting.findMany({ where: { featureId: id }, orderBy: { priority: 'desc' } });
    return successResponse(routings);
  } catch (e) {
    return handleApiError(e);
  }
}
