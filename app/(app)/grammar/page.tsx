'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { GrammarTopicCard, type GrammarRow } from '@/components/grammar/grammar-topic-card';
import { GroupedAccordion } from '@/components/groups/grouped-accordion';
import { DeleteGroupDialog, GroupFormDialog, type DeleteTarget, type GroupFormMode } from '@/components/groups/group-dialogs';
import { flattenGroupOptions, type GroupLabels, totalItems } from '@/components/groups/types';
import { useGroupCollapse } from '@/components/groups/use-collapse';
import { Button, buttonVariants } from '@/components/ui/button';
import { Spinner } from '@/components/ui/feedback';
import { ApiClientError, apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api/client';
import type { CreateGroupDto, GroupNode, GroupTree } from '@/lib/api/collection-groups';
import { cn } from '@/lib/utils';

export default function GrammarPage() {
  const t = useTranslations('grammar');
  const tg = useTranslations('group');
  const tc = useTranslations('common');
  const qc = useQueryClient();

  const topics = useQuery({
    queryKey: ['grammar'],
    queryFn: () => apiGet<{ items: GrammarRow[]; total: number }>('/api/grammar?pageSize=100'),
  });
  const tree = useQuery({ queryKey: ['groups', 'GRAMMAR'], queryFn: () => apiGet<GroupTree>('/api/groups?domain=GRAMMAR') });

  const [open, setOpen] = useGroupCollapse('lla:grammar:open-groups');
  const [formMode, setFormMode] = useState<GroupFormMode | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['grammar'] });
    void qc.invalidateQueries({ queryKey: ['groups', 'GRAMMAR'] });
  };
  const onMutationError = (e: unknown) => setFormError(e instanceof ApiClientError ? e.message : tg('genericError'));

  const createGroup = useMutation({
    mutationFn: (dto: CreateGroupDto) => apiPost<GroupNode>('/api/groups', { ...dto, domain: 'GRAMMAR' }),
    onSuccess: () => {
      setFormMode(null);
      invalidate();
    },
    onError: onMutationError,
  });

  const renameGroup = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => apiPatch<GroupNode>(`/api/groups/${id}`, { name }),
    onSuccess: () => {
      setFormMode(null);
      invalidate();
    },
    onError: onMutationError,
  });

  const deleteGroup = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/groups/${id}`),
    onSuccess: () => {
      setDeleteTarget(null);
      invalidate();
    },
    onError: onMutationError,
  });

  const moveTopic = useMutation({
    mutationFn: ({ id, groupId }: { id: string; groupId: string | null }) =>
      apiPatch<GrammarRow>(`/api/grammar/${id}`, { groupId }),
    onSuccess: () => {
      setMoveError(null);
      invalidate();
    },
    onError: (e) => setMoveError(e instanceof ApiClientError ? e.message : tg('genericError')),
  });
  const movingId = moveTopic.isPending ? (moveTopic.variables?.id ?? null) : null;

  const groups = tree.data?.groups ?? [];
  const options = useMemo(() => flattenGroupOptions(groups), [groups]);
  const topicsByGroup = useMemo(() => {
    const map = new Map<string, GrammarRow[]>();
    for (const item of topics.data?.items ?? []) {
      if (item.groupId) map.set(item.groupId, [...(map.get(item.groupId) ?? []), item]);
    }
    return map;
  }, [topics.data]);
  const ungrouped = useMemo(() => (topics.data?.items ?? []).filter((item) => !item.groupId), [topics.data]);

  const actions = {
    onAddSubgroup: (parent: GroupNode) => {
      setFormError(null);
      setFormMode({ kind: 'createSubgroup', parentId: parent.id, parentName: parent.name });
    },
    onRename: (node: GroupNode) => {
      setFormError(null);
      setFormMode({ kind: 'rename', id: node.id, currentName: node.name });
    },
    onDelete: (node: GroupNode) => {
      setFormError(null);
      setDeleteTarget({ id: node.id, name: node.name, itemCount: totalItems(node) });
    },
  };
  const openCreateGroup = () => {
    setFormError(null);
    setFormMode({ kind: 'createGroup' });
  };

  const submitForm = (name: string) => {
    setFormError(null);
    if (formMode?.kind === 'rename') renameGroup.mutate({ id: formMode.id, name });
    else if (formMode?.kind === 'createSubgroup') createGroup.mutate({ name, parentId: formMode.parentId });
    else createGroup.mutate({ name });
  };

  const labels: GroupLabels = {
    addGroup: tg('addGroup'),
    addSubgroup: tg('addSubgroup'),
    rename: tg('rename'),
    delete: tg('delete'),
    moveTo: tg('moveTo'),
    ungrouped: tg('ungrouped'),
    namePlaceholder: tg('namePlaceholder'),
    emptyGroup: tg('emptyGroup'),
    emptySubgroup: tg('emptySubgroup'),
    subgroupOf: (name) => tg('subgroupOf', { name }),
    deleteTitle: (name) => tg('deleteTitle', { name }),
    deleteConfirm: (count) => tg('deleteConfirm', { count }),
    cancel: tc('cancel'),
    save: tc('save'),
  };

  const isLoading = topics.isLoading || tree.isLoading;
  const totalCount = topics.data?.total ?? 0;
  const isEmpty = !isLoading && totalCount === 0;
  const hasGroups = groups.length > 0;
  const loadError = topics.error ?? tree.error;

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <h1 className="mb-1 font-display text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle', { count: totalCount })}</p>
        </div>
        <Link href="/grammar/review" className={cn(buttonVariants())}>
          {t('review')}
        </Link>
      </div>

      {loadError && <p className="mb-4 text-sm text-destructive">{tg('loadError')}</p>}
      {moveError && <p className="mb-4 text-sm text-destructive">{moveError}</p>}

      {hasGroups && (
        <div className="mb-3 flex justify-end">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={openCreateGroup}>
            <Plus className="h-4 w-4" /> {tg('addGroup')}
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner className="text-primary" />
        </div>
      ) : isEmpty ? (
        <p className="py-12 text-center text-sm text-muted-foreground">{t('empty')}</p>
      ) : (
        <GroupedAccordion<GrammarRow>
          groups={groups}
          itemsByGroup={topicsByGroup}
          ungrouped={ungrouped}
          open={open}
          onOpenChange={setOpen}
          actions={actions}
          options={options}
          movingId={movingId}
          onMove={(id, groupId) => moveTopic.mutate({ id, groupId })}
          getItemId={(item) => item.id}
          labels={labels}
          onAddGroup={openCreateGroup}
          renderItem={(item, ctx) => (
            <GrammarTopicCard topic={item} options={ctx.options} moving={ctx.moving} onMove={ctx.onMove} />
          )}
        />
      )}

      <GroupFormDialog
        mode={formMode}
        pending={createGroup.isPending || renameGroup.isPending}
        error={formError}
        labels={labels}
        onSubmit={submitForm}
        onClose={() => setFormMode(null)}
      />
      <DeleteGroupDialog
        target={deleteTarget}
        pending={deleteGroup.isPending}
        error={formError}
        labels={labels}
        onConfirm={() => deleteTarget && deleteGroup.mutate(deleteTarget.id)}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}
