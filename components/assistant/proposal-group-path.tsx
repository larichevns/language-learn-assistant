'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/feedback';
import { apiGet } from '@/lib/api/client';
import { type GroupDomainStr, type GroupTree, normGroupName } from '@/lib/api/collection-groups';

/** The group-routing fields a taxonomy proposal payload may carry. */
interface GroupPayload {
  group?: string | null;
  subgroup?: string | null;
  groupId?: string | null;
  subgroupId?: string | null;
}

/** Proposal target types that carry a browsable group taxonomy, mapped to their domain. */
const TARGET_DOMAIN: Record<string, GroupDomainStr> = {
  VOCAB_ENTRY: 'VOCAB',
  GRAMMAR_TOPIC: 'GRAMMAR',
  CLASS_NOTE: 'NOTE',
};

function readGroupPayload(payload: unknown): GroupPayload {
  if (typeof payload !== 'object' || payload === null) return {};
  const p = payload as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  return { group: str(p.group), subgroup: str(p.subgroup), groupId: str(p.groupId), subgroupId: str(p.subgroupId) };
}

/**
 * Renders the `group → subgroup` path chip for a taxonomy proposal (vocab,
 * grammar or note), plus a client-side "new group/subgroup" marker computed by
 * comparing the payload's names against the cached group tree of the matching
 * domain. Returns null for non-taxonomy targets or when no routing is present.
 */
export function ProposalGroupPath({ targetType, payload }: { targetType: string; payload: unknown }) {
  const tg = useTranslations('group');
  const domain = TARGET_DOMAIN[targetType];
  const { group, subgroup } = readGroupPayload(payload);

  // Read the cached taxonomy for this domain; fetch once if absent (background,
  // never on the Apply path). Keyed per domain so each taxonomy caches separately.
  const { data: tree } = useQuery({
    queryKey: ['groups', domain],
    queryFn: () => apiGet<GroupTree>(`/api/groups?domain=${domain}`),
    staleTime: 60_000,
    enabled: Boolean(domain && (group || subgroup)),
  });

  if (!domain || (!group && !subgroup)) return null;

  const topGroups = tree?.groups ?? [];
  const matchedGroup = group ? topGroups.find((g) => normGroupName(g.name) === normGroupName(group)) : undefined;
  // "new" only when the tree is loaded and the name is absent — avoids a false flag while loading.
  const groupIsNew = Boolean(group) && tree !== undefined && matchedGroup === undefined;
  const subgroupIsNew =
    Boolean(subgroup) &&
    tree !== undefined &&
    !(matchedGroup?.children ?? []).some((c) => normGroupName(c.name) === normGroupName(subgroup as string));

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <Badge variant="muted" className="font-medium">
        {subgroup ? `${group ?? '—'} → ${subgroup}` : group}
      </Badge>
      {groupIsNew && <Badge variant="success">{tg('newGroup')}</Badge>}
      {!groupIsNew && subgroupIsNew && <Badge variant="success">{tg('newSubgroup')}</Badge>}
    </div>
  );
}
