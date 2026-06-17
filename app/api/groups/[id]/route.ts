/**
 * Generic group taxonomy — item endpoints (domain-parametrized).
 *   PATCH  /api/groups/[id] → rename / recolor / move / reorder (UpdateGroupDto),
 *          returns fresh GroupNode
 *   DELETE /api/groups/[id] → { id, deleted:true } (cascades subgroups; items
 *          SET NULL → ungrouped across all three relations)
 * Ownership via `where: { id, userId }`; the row's own `domain` scopes every
 * dedup/parent lookup. The 2-level invariant + name dedup are validated in code.
 */
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { ApiError, handleApiError, successResponse } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/client';
import { COUNT_RELATION, type GroupNode, normGroupName } from '@/lib/api/collection-groups';

const UpdateGroupDto = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  parentId: z.string().nullish(),
  emoji: z.string().max(8).nullish(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullish(),
  orderIndex: z.number().int().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const parsed = UpdateGroupDto.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return handleApiError(new ApiError('invalid_input', 'Invalid update', 400));
    const body = parsed.data;

    const row = await prisma.collectionGroup.findFirst({
      where: { id, userId: user.userId },
      select: { id: true, domain: true, parentId: true, nameNorm: true, _count: { select: { children: true } } },
    });
    if (!row) throw new ApiError('not_found', 'Group not found', 404);
    const domain = row.domain; // every subsequent lookup is scoped to THIS row's domain

    const data: {
      name?: string;
      nameNorm?: string;
      parentId?: string | null;
      emoji?: string | null;
      color?: string | null;
      orderIndex?: number;
    } = {};

    // ── Move (parentId provided) ──
    const movingParent = body.parentId !== undefined;
    let targetParentId: string | null = row.parentId;
    if (movingParent) {
      const next = body.parentId ?? null;
      if (next === id) throw new ApiError('invalid_input', 'A group cannot be its own parent', 422);
      if (next !== null) {
        // Becoming a subgroup: parent must be owned, SAME domain + a TOP group, and
        // THIS group must not itself have children (that would create a 3rd level).
        const parent = await prisma.collectionGroup.findFirst({
          where: { id: next, userId: user.userId, domain },
          select: { parentId: true },
        });
        if (!parent) throw new ApiError('invalid_input', 'Parent group not found', 422);
        if (parent.parentId !== null) throw new ApiError('invalid_input', 'Only two levels allowed', 422);
        if (row._count.children > 0)
          throw new ApiError('invalid_input', 'A group with subgroups cannot become a subgroup', 422);
      }
      targetParentId = next;
      data.parentId = next;
    }

    // ── Rename (recompute nameNorm; dedup within the TARGET parent, excluding self) ──
    if (body.name !== undefined) {
      data.name = body.name;
      data.nameNorm = normGroupName(body.name);
    }
    const effectiveNameNorm = data.nameNorm ?? row.nameNorm;
    if (data.nameNorm !== undefined || movingParent) {
      const dup = await prisma.collectionGroup.findFirst({
        where: { userId: user.userId, domain, parentId: targetParentId, nameNorm: effectiveNameNorm, id: { not: id } },
        select: { id: true },
      });
      if (dup) throw new ApiError('conflict', 'A group with this name already exists here', 409);
    }

    if (body.emoji !== undefined) data.emoji = body.emoji ?? null;
    if (body.color !== undefined) data.color = body.color ?? null;
    if (body.orderIndex !== undefined) data.orderIndex = body.orderIndex;

    await prisma.collectionGroup.update({ where: { id }, data });

    const countRel = COUNT_RELATION[domain];
    const fresh = await prisma.collectionGroup.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        name: true,
        emoji: true,
        color: true,
        orderIndex: true,
        _count: { select: { [countRel]: true } },
      },
    });
    const node: GroupNode = {
      id: fresh.id,
      name: fresh.name,
      emoji: fresh.emoji,
      color: fresh.color,
      orderIndex: fresh.orderIndex,
      itemCount: (fresh._count as Record<string, number>)[countRel] ?? 0,
    };
    return successResponse(node);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await params;
    // DB cascades subgroups and SET NULLs items (→ ungrouped) across all relations.
    const res = await prisma.collectionGroup.deleteMany({ where: { id, userId: user.userId } });
    if (!res.count) throw new ApiError('not_found', 'Group not found', 404);
    return successResponse({ id, deleted: true });
  } catch (e) {
    return handleApiError(e);
  }
}
