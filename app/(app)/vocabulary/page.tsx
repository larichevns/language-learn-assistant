'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Brain, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { GroupedAccordion } from '@/components/groups/grouped-accordion';
import { DeleteGroupDialog, GroupFormDialog, type DeleteTarget, type GroupFormMode } from '@/components/groups/group-dialogs';
import { flattenGroupOptions, type GroupLabels, totalItems } from '@/components/groups/types';
import { useGroupCollapse } from '@/components/groups/use-collapse';
import { buttonVariants, Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/feedback';
import { SearchInput } from '@/components/ui/search-input';
import { AddWordForm } from '@/components/vocabulary/add-word-form';
import type { VocabListResponse, VocabRow } from '@/components/vocabulary/types';
import { WordCard } from '@/components/vocabulary/word-card';
import { ApiClientError, apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api/client';
import type { CreateGroupDto, GroupNode, GroupTree } from '@/lib/api/collection-groups';
import { cn } from '@/lib/utils';

export default function VocabularyPage() {
  const t = useTranslations('vocab');
  const tg = useTranslations('group');
  const tc = useTranslations('common');
  const qc = useQueryClient();

  const words = useQuery({ queryKey: ['vocab'], queryFn: () => apiGet<VocabListResponse>('/api/vocabulary?pageSize=200') });
  const tree = useQuery({ queryKey: ['vocab-groups'], queryFn: () => apiGet<GroupTree>('/api/groups?domain=VOCAB') });

  const [search, setSearch] = useState('');
  const [open, setOpen] = useGroupCollapse('lla:vocab:open-groups');
  const [formMode, setFormMode] = useState<GroupFormMode | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['vocab'] });
    void qc.invalidateQueries({ queryKey: ['vocab-groups'] });
  };
  const onMutationError = (e: unknown) => setFormError(e instanceof ApiClientError ? e.message : tg('genericError'));

  const createGroup = useMutation({
    mutationFn: (dto: CreateGroupDto) => apiPost<GroupNode>('/api/groups', { ...dto, domain: 'VOCAB' }),
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

  const moveWord = useMutation({
    mutationFn: ({ id, groupId }: { id: string; groupId: string | null }) =>
      apiPatch<VocabRow>(`/api/vocabulary/${id}`, { groupId }),
    onSuccess: () => {
      setMoveError(null);
      invalidate();
    },
    onError: (e) => setMoveError(e instanceof ApiClientError ? e.message : tg('genericError')),
  });
  const movingId = moveWord.isPending ? (moveWord.variables?.id ?? null) : null;

  const groups = tree.data?.groups ?? [];
  const options = useMemo(() => flattenGroupOptions(groups), [groups]);
  const filteredWords = useMemo(() => {
    const q = search.trim().toLowerCase();
    const items = words.data?.items ?? [];
    if (!q) return items;
    return items.filter((w) => w.lemma.toLowerCase().includes(q) || w.translationRu.toLowerCase().includes(q));
  }, [words.data, search]);
  const wordsByGroup = useMemo(() => {
    const map = new Map<string, VocabRow[]>();
    for (const w of filteredWords) {
      if (w.groupId) map.set(w.groupId, [...(map.get(w.groupId) ?? []), w]);
    }
    return map;
  }, [filteredWords]);
  const ungrouped = useMemo(() => filteredWords.filter((w) => !w.groupId), [filteredWords]);

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

  // i18n strings the generic group family renders, drawn from the vocab namespaces.
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

  const isLoading = words.isLoading || tree.isLoading;
  const totalCount = words.data?.total ?? 0;
  const isEmpty = !isLoading && totalCount === 0;
  const hasGroups = groups.length > 0;
  const loadError = words.error ?? tree.error;

  return (
    <div className="mx-auto max-w-5xl p-6">
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('count', { count: totalCount })}</p>
        </div>
        <Link href="/vocabulary/review" className={cn(buttonVariants(), 'gap-2')}>
          <Brain className="h-4 w-4" /> {t('review')}
        </Link>
      </div>

      <AddWordForm />

      {loadError && <p className="mb-4 text-sm text-destructive">{tg('loadError')}</p>}
      {moveError && <p className="mb-4 text-sm text-destructive">{moveError}</p>}

      {totalCount > 0 && (
        <div className="mb-4">
          <SearchInput value={search} onChange={setSearch} placeholder={t('searchPlaceholder')} clearLabel={tc('clearSearch')} />
        </div>
      )}

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
        <GroupedAccordion<VocabRow>
          groups={groups}
          itemsByGroup={wordsByGroup}
          ungrouped={ungrouped}
          open={open}
          onOpenChange={setOpen}
          actions={actions}
          options={options}
          movingId={movingId}
          onMove={(id, groupId) => moveWord.mutate({ id, groupId })}
          getItemId={(w) => w.id}
          labels={labels}
          onAddGroup={openCreateGroup}
          renderItem={(w, ctx) => (
            <WordCard word={w} options={ctx.options} moving={ctx.moving} onMove={ctx.onMove} />
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
