import { Prisma } from '@prisma/client';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { ApiError, handleApiError, successResponse } from '@/lib/api/response';
import { requireAdmin } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/client';

export async function GET() {
  try {
    await requireAdmin();
    return successResponse(await prisma.promptVariable.findMany({ orderBy: { key: 'asc' } }));
  } catch (e) {
    return handleApiError(e);
  }
}

const CreateBody = z.object({
  key: z.string().regex(/^[a-z0-9_]+$/, 'lowercase snake_case'),
  name: z.string(),
  varType: z.enum(['string', 'number', 'enum']),
  enumValuesJson: z.array(z.string()).optional(),
  validationRegex: z.string().optional(),
  defaultValue: z.string().optional(),
  description: z.string().optional(),
  isRequired: z.boolean().optional(),
});

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
    const parsed = CreateBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return handleApiError(new ApiError('invalid_input', 'Invalid variable', 400));
    const d = parsed.data;
    const existing = await prisma.promptVariable.findUnique({ where: { key: d.key } });
    if (existing) throw new ApiError('conflict', 'Variable key already exists', 409);
    const row = await prisma.promptVariable.create({
      data: {
        key: d.key,
        name: d.name,
        varType: d.varType,
        enumValuesJson: (d.enumValuesJson ?? undefined) as Prisma.InputJsonValue | undefined,
        validationRegex: d.validationRegex,
        defaultValue: d.defaultValue,
        description: d.description,
        isRequired: d.isRequired ?? false,
      },
    });
    return successResponse(row, 201);
  } catch (e) {
    return handleApiError(e);
  }
}
