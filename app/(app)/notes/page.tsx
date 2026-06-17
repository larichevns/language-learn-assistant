'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { GroupedAccordion } from '@/components/groups/grouped-accordion';
import { DeleteGroupDialog, GroupFormDialog, type DeleteTarget, type GroupFormMode } from '@/components/groups/group-dialogs';
import { flattenGroupOptions, type GroupLabels, totalItems } from '@/components/groups/types';
import { useGroupCollapse } from '@/components/groups/use-collapse';
import { NoteCard, type NoteRow } from '@/components/notes/note-card';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/feedback';
import { Composer } from '@/components/writing/composer';
import { ApiClientError, apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api/client';
import type { CreateGroupDto, GroupNode, GroupTree } from '@/lib/api/collection-groups';

export default function NotesPage() {
  const t = useTranslations('notes');
  const tg = useTranslations('group');
  const tc = useTranslations('common');
  const qc = useQueryClient();
  const router = useRouter();

  const notes = useQuery({ queryKey: ['notes'], queryFn: () => apiGet<{ items: NoteRow[]; total: number }>('/api/notes?pageSize=100') });
  const tree = useQuery({ queryKey: ['groups', 'NOTE'], queryFn: () => apiGet<GroupTree>('/api/groups?domain=NOTE') });

  const [title, setTitle] = useState('');
  const [rawInput, setRawInput] = useState('');
  const [open, setOpen] = useGroupCollapse('lla:notes:open-groups');
  const [formMode, setFormMode] = useState<GroupFormMode | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['notes'] });
    void qc.invalidateQueries({ queryKey: ['groups', 'NOTE'] });
  };
  const onMutationError = (e: unknown) => setFormError(e instanceof ApiClientError ? e.message : tg('genericError'));

  const create = useMutation({
    mutationFn: () => apiPost<{ id: string }>('/api/notes', { title: title || undefined, rawInput }),
    onSuccess: (n) => {
      void qc.invalidateQueries({ queryKey: ['notes'] });
      router.push(`/notes/${n.id}`);
    },
  });

  const createGroup = useMutation({
    mutationFn: (dto: CreateGroupDto) => apiPost<GroupNode>('/api/groups', { ...dto, domain: 'NOTE' }),
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

  const moveNote = useMutation({
    mutationFn: ({ id, groupId }: { id: string; groupId: string | null }) =>
      apiPatch<NoteRow>(`/api/notes/${id}`, { groupId }),
    onSuccess: () => {
      setMoveError(null);
      invalidate();
    },
    onError: (e) => setMoveError(e instanceof ApiClientError ? e.message : tg('genericError')),
  });
  const movingId = moveNote.isPending ? (moveNote.variables?.id ?? null) : null;

  const groups = tree.data?.groups ?? [];
  const options = useMemo(() => flattenGroupOptions(groups), [groups]);
  const notesByGroup = useMemo(() => {
    const map = new Map<string, NoteRow[]>();
    for (const n of notes.data?.items ?? []) {
      if (n.groupId) map.set(n.groupId, [...(map.get(n.groupId) ?? []), n]);
    }
    return map;
  }, [notes.data]);
  const ungrouped = useMemo(() => (notes.data?.items ?? []).filter((n) => !n.groupId), [notes.data]);

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

  const isLoading = notes.isLoading || tree.isLoading;
  const totalCount = notes.data?.total ?? 0;
  const isEmpty = !isLoading && totalCount === 0;
  const hasGroups = groups.length > 0;
  const loadError = notes.error ?? tree.error;

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="mb-1 font-display text-2xl font-bold">{t('title')}</h1>
      <p className="mb-5 text-sm text-muted-foreground">{t('subtitle')}</p>

      <div className="mb-6">
        <Composer
          title={title}
          onTitleChange={setTitle}
          titlePlaceholder={t('titlePlaceholder')}
          value={rawInput}
          onChange={setRawInput}
          placeholder={t('textPlaceholder')}
          onSubmit={() => create.mutate()}
          submitLabel={tc('save')}
          submitting={create.isPending}
          submitDisabled={!rawInput.trim()}
        />
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
        <div className="flex justify-center py-10">
          <Spinner className="text-primary" />
        </div>
      ) : isEmpty ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t('empty')}</p>
      ) : (
        <GroupedAccordion<NoteRow>
          groups={groups}
          itemsByGroup={notesByGroup}
          ungrouped={ungrouped}
          open={open}
          onOpenChange={setOpen}
          actions={actions}
          options={options}
          movingId={movingId}
          onMove={(id, groupId) => moveNote.mutate({ id, groupId })}
          getItemId={(n) => n.id}
          labels={labels}
          onAddGroup={openCreateGroup}
          renderItem={(n, ctx) => <NoteCard note={n} options={ctx.options} moving={ctx.moving} onMove={ctx.onMove} />}
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
