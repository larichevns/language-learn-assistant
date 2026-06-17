/**
 * Domain-neutral DTOs + constants for the generic two-level taxonomy
 * (group → subgroup) shared by vocab, grammar and notes. Consumed by the
 * `/api/groups` route handlers and the AI Apply dispatcher (apply-db).
 *
 * This generalizes the former `lib/api/vocab-groups.ts`: the per-leaf count is
 * `itemCount` (was vocab-specific `wordCount`), and the `domain` discriminator is
 * threaded through every query via the maps below. Logic (create/update/delete/
 * tree) lives in the route handlers — this module is the frozen contract + the
 * `normGroupName` dedup helper (the one thing routes + apply-db MUST share).
 */
import type { GroupDomain } from '@prisma/client';

export type GroupDomainStr = 'VOCAB' | 'GRAMMAR' | 'NOTE';

export type GroupNode = {
  id: string;
  name: string;
  emoji: string | null;
  color: string | null;
  orderIndex: number;
  itemCount: number; // DIRECT items with groupId === this node (domain-neutral; was wordCount)
  children?: GroupNode[]; // top-level only
};

export type GroupTree = { groups: GroupNode[]; ungroupedCount: number };

export type CreateGroupDto = { name: string; parentId?: string | null; emoji?: string; color?: string };

export type UpdateGroupDto = {
  name?: string;
  parentId?: string | null;
  emoji?: string;
  color?: string;
  orderIndex?: number;
};

export type MoveItemDto = { groupId: string | null }; // was MoveVocabDto

/** Single source of truth for group-name dedup normalization (routes + apply-db). */
export const normGroupName = (s: string): string => s.trim().toLowerCase();

/** Which relation holds the per-leaf count, per domain — used by the GET tree builder. */
export const COUNT_RELATION: Record<GroupDomainStr, 'vocabEntries' | 'grammarTopics' | 'classNotes'> = {
  VOCAB: 'vocabEntries',
  GRAMMAR: 'grammarTopics',
  NOTE: 'classNotes',
};

/** The Prisma model delegate whose rows carry groupId, per domain (for ungrouped counts). */
export type DomainItemModel = 'vocabEntry' | 'grammarTopic' | 'classNote';
export const ITEM_MODEL: Record<GroupDomainStr, DomainItemModel> = {
  VOCAB: 'vocabEntry',
  GRAMMAR: 'grammarTopic',
  NOTE: 'classNote',
};

/** Validate a `?domain=` query param into the enum string (null on bad/missing). */
export function parseDomain(v: string | null): GroupDomainStr | null {
  return v === 'VOCAB' || v === 'GRAMMAR' || v === 'NOTE' ? v : null;
}

// Re-export the Prisma enum type for downstream typing (apply-db, etc.).
export type { GroupDomain };
