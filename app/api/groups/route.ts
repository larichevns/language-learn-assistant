/**
 * Generic group taxonomy — collection endpoints (domain-parametrized).
 *   GET  /api/groups?domain=VOCAB|GRAMMAR|NOTE
 *        → GroupTree (tops with nested subgroups + direct item counts + ungroupedCount)
 *   POST /api/groups   body: CreateGroupDto & { domain }
 *        → create a top group or a subgroup, returns GroupNode
 * Ownership is enforced everywhere via `where: { userId, domain }`; the 2-level
 * invariant and top-level name dedup are validated in code (see collection-grouping
 * plan §2.2). The `domain` segment scopes every query so a VOCAB "Еда" and a
 * GRAMMAR "Еда" coexist as different rows.
 */
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { ApiError, handleApiError, successResponse } from '@/lib/api/response';
import { requireUser } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/client';
import {
  COUNT_RELATION,
  type GroupNode,
  type GroupTree,
  ITEM_MODEL,
  normGroupName,
  parseDomain,
} from '@/lib/api/collection-groups';

const CreateGroupDto = z.object({
  domain: z.string(),
  name: z.string().trim().min(1).max(60),
  parentId: z.string().nullish(),
  emoji: z.string().max(8).nullish(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullish(),
});

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const domain = parseDomain(new URL(req.url).searchParams.get('domain'));
    if (!domain) return handleApiError(new ApiError('invalid_input', 'Bad or missing domain', 400));

    const countRel = COUNT_RELATION[domain];
    const [rows, ungroupedCount] = await Promise.all([
      prisma.collectionGroup.findMany({
        where: { userId: user.userId, domain },
        orderBy: [{ orderIndex: 'asc' }, { name: 'asc' }],
        select: {
          id: true,
          name: true,
          emoji: true,
          color: true,
          orderIndex: true,
          parentId: true,
          _count: { select: { [countRel]: true } },
        },
      }),
      // ungrouped count: the domain's item model where groupId is null
      (prisma[ITEM_MODEL[domain]] as { count: (args: unknown) => Promise<number> }).count({
        where: { userId: user.userId, groupId: null },
      }),
    ]);

    const itemCountOf = (r: (typeof rows)[number]): number =>
      (r._count as Record<string, number>)[countRel] ?? 0;
    const toNode = (r: (typeof rows)[number]): GroupNode => ({
      id: r.id,
      name: r.name,
      emoji: r.emoji,
      color: r.color,
      orderIndex: r.orderIndex,
      itemCount: itemCountOf(r), // DIRECT items only
    });

    const tops = rows.filter((r) => r.parentId === null);
    const groups: GroupNode[] = tops.map((t) => ({
      ...toNode(t),
      children: rows.filter((r) => r.parentId === t.id).map(toNode),
    }));

    const tree: GroupTree = { groups, ungroupedCount };
    return successResponse(tree);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const parsed = CreateGroupDto.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return handleApiError(new ApiError('invalid_input', 'Invalid group', 400));
    const domain = parseDomain(parsed.data.domain);
    if (!domain) return handleApiError(new ApiError('invalid_input', 'Bad or missing domain', 400));
    const { name, parentId, emoji, color } = parsed.data;

    // Level invariant: a subgroup's parent must exist, be owned, be SAME domain, and be a TOP group.
    if (parentId) {
      const parent = await prisma.collectionGroup.findFirst({
        where: { id: parentId, userId: user.userId, domain },
        select: { parentId: true },
      });
      if (!parent) throw new ApiError('invalid_input', 'Parent group not found', 422);
      if (parent.parentId !== null) throw new ApiError('invalid_input', 'Only two levels allowed', 422);
    }

    // Dedup within the same parent. REQUIRED for top-level: Postgres treats NULL
    // parentId as distinct, so the @@unique([userId,domain,parentId,nameNorm]) won't catch it.
    const nameNorm = normGroupName(name);
    const dup = await prisma.collectionGroup.findFirst({
      where: { userId: user.userId, domain, parentId: parentId ?? null, nameNorm },
      select: { id: true },
    });
    if (dup) throw new ApiError('conflict', 'A group with this name already exists here', 409);

    const row = await prisma.collectionGroup.create({
      data: {
        userId: user.userId,
        domain,
        parentId: parentId ?? null,
        name,
        nameNorm,
        emoji: emoji ?? null,
        color: color ?? null,
      },
      select: { id: true, name: true, emoji: true, color: true, orderIndex: true },
    });

    const node: GroupNode = { ...row, itemCount: 0 };
    return successResponse(node, 201);
  } catch (e) {
    return handleApiError(e);
  }
}
