'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/field';
import { Spinner } from '@/components/ui/feedback';
import type { GroupLabels } from './types';

export type GroupFormMode =
  | { kind: 'createGroup' }
  | { kind: 'createSubgroup'; parentId: string; parentName: string }
  | { kind: 'rename'; id: string; currentName: string };

/** Create-group / create-subgroup / rename — a single name field, one submit. */
export function GroupFormDialog({
  mode,
  pending,
  error,
  labels,
  onSubmit,
  onClose,
}: {
  mode: GroupFormMode | null;
  pending: boolean;
  error: string | null;
  labels: GroupLabels;
  onSubmit: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');

  useEffect(() => {
    setName(mode?.kind === 'rename' ? mode.currentName : '');
  }, [mode]);

  const title =
    mode?.kind === 'createGroup'
      ? labels.addGroup
      : mode?.kind === 'createSubgroup'
        ? labels.addSubgroup
        : labels.rename;
  const description = mode?.kind === 'createSubgroup' ? labels.subgroupOf(mode.parentName) : null;
  const trimmed = name.trim();

  return (
    <Dialog open={mode !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-2xl sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (trimmed && !pending) onSubmit(trimmed);
          }}
        >
          <Input
            autoFocus
            value={name}
            maxLength={60}
            placeholder={labels.namePlaceholder}
            onChange={(e) => setName(e.target.value)}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
              {labels.cancel}
            </Button>
            <Button type="submit" disabled={!trimmed || pending} className="gap-1.5">
              {pending && <Spinner />}
              {labels.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export interface DeleteTarget {
  id: string;
  name: string;
  itemCount: number;
}

/** Destructive confirm — surfaces how many items will fall back to "ungrouped". */
export function DeleteGroupDialog({
  target,
  pending,
  error,
  labels,
  onConfirm,
  onClose,
}: {
  target: DeleteTarget | null;
  pending: boolean;
  error: string | null;
  labels: GroupLabels;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={target !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-2xl sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{labels.deleteTitle(target?.name ?? '')}</DialogTitle>
          <DialogDescription>{labels.deleteConfirm(target?.itemCount ?? 0)}</DialogDescription>
        </DialogHeader>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            {labels.cancel}
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm} disabled={pending} className="gap-1.5">
            {pending && <Spinner />}
            {labels.delete}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
