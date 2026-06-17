import type { GroupNode } from '@/lib/api/collection-groups';

/**
 * A flattened group option for the "move to" select: keeps the visual path label.
 * Domain-neutral — used identically by vocab, grammar and note leaf cards.
 */
export interface GroupOption {
  id: string;
  /** Display label, e.g. "🍎 Еда → Овощи" or "🍎 Еда". */
  label: string;
  /** Nesting depth (0 = top-level group, 1 = subgroup) for indentation. */
  depth: number;
}

/** Callbacks a group/subgroup header invokes; the page owns the dialog state. */
export interface GroupActions {
  onAddSubgroup: (parent: GroupNode) => void;
  onRename: (node: GroupNode) => void;
  onDelete: (node: GroupNode) => void;
}

/**
 * i18n strings the generic accordion + dialogs render. Each domain page builds
 * this from a next-intl namespace — the structural strings live in the shared
 * `group` namespace (vocab/grammar/notes all draw from it), so no namespace is
 * hardcoded in the family. Interpolated strings (`subgroupOf`, `deleteTitle`,
 * `deleteConfirm`) are passed as resolvers so the caller's `t(key, params)` formats.
 */
export interface GroupLabels {
  addGroup: string;
  addSubgroup: string;
  rename: string;
  delete: string;
  moveTo: string;
  ungrouped: string;
  namePlaceholder: string;
  emptyGroup: string;
  emptySubgroup: string;
  /** Dialog title for create-subgroup, e.g. "Subgroup of «Еда»". */
  subgroupOf: (name: string) => string;
  /** Delete-dialog title, e.g. "Delete «Еда»?". */
  deleteTitle: (name: string) => string;
  /** Delete-dialog body, pluralized on the affected item count. */
  deleteConfirm: (count: number) => string;
  /** Generic form actions, reused from the shared `common` namespace. */
  cancel: string;
  save: string;
}

/** Render a node header label: `emoji name` (emoji optional). */
export function nodeLabel(node: Pick<GroupNode, 'name' | 'emoji'>): string {
  return node.emoji ? `${node.emoji} ${node.name}` : node.name;
}

/**
 * Total items a node CONTAINS = its own direct items + every subgroup's items.
 * `GroupNode.itemCount` is direct-only (a top group with all items in subgroups
 * has direct 0), so headers and the delete-confirm count must roll up children.
 */
export function totalItems(node: GroupNode): number {
  return node.itemCount + (node.children?.reduce((sum, c) => sum + c.itemCount, 0) ?? 0);
}

/**
 * Flatten the group tree into ordered move-to options. An item's leaf is either a
 * subgroup or a top-level group with no children — both are valid targets.
 */
export function flattenGroupOptions(groups: GroupNode[]): GroupOption[] {
  const out: GroupOption[] = [];
  for (const group of groups) {
    out.push({ id: group.id, label: nodeLabel(group), depth: 0 });
    for (const child of group.children ?? []) {
      out.push({ id: child.id, label: `${nodeLabel(group)} → ${child.name}`, depth: 1 });
    }
  }
  return out;
}
