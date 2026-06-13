import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { ApiError, handleApiError, successResponse } from '@/lib/api/response';
import { requireAdmin } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/client';

export async function GET() {
  try {
    await requireAdmin();
    const features = await prisma.featureFlag.findMany({
      orderBy: { slug: 'asc' },
      include: {
        routings: { include: { model: { select: { modelId: true, providerId: true } } }, orderBy: { priority: 'desc' } },
        _count: { select: { templates: true } },
      },
    });
    return successResponse(features);
  } catch (e) {
    return handleApiError(e);
  }
}

const CreateBody = z.object({
  slug: z.string().regex(/^[a-z0-9_]+$/),
  name: z.string(),
  category: z.string().optional(),
  operationType: z.string().optional(),
  description: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const parsed = CreateBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return handleApiError(new ApiError('invalid_input', 'Invalid feature', 400));
    const d = parsed.data;
    const exists = await prisma.featureFlag.findUnique({ where: { slug: d.slug } });
    if (exists) throw new ApiError('conflict', 'Feature slug exists', 409);
    const row = await prisma.featureFlag.create({
      data: {
        slug: d.slug,
        name: d.name,
        category: d.category,
        operationType: d.operationType ?? 'text_completion',
        description: d.description,
      },
    });
    return successResponse(row, 201);
  } catch (e) {
    return handleApiError(e);
  }
}
