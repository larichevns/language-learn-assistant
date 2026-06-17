'use client';

import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import type { GroupNode } from '@/lib/api/collection-groups';
import { cn } from '@/lib/utils';
import { type GroupActions, type GroupLabels, type GroupOption, nodeLabel, totalItems } from './types';

/** Context handed to a leaf renderer so each page can wire its own "move to" Select. */
export interface LeafContext {
  options: GroupOption[];
  moving: boolean;
  onMove: (groupId: string | null) => void;
}

export interface GroupedAccordionProps<T> {
  /** Group tree from `GET /api/groups?domain=…`. */
  groups: GroupNode[];
  /** leafId → items attached directly to that node (the page builds this). */
  itemsByGroup: Map<string, T[]>;
  /** Items with no group. */
  ungrouped: T[];
  /** Open node ids (persisted by the page via useGroupCollapse). */
  open: string[];
  onOpenChange: (next: string[]) => void;
  /** Header callbacks (add-subgroup / rename / delete). */
  actions: GroupActions;
  /** Flattened move-to targets — `flattenGroupOptions(groups)`. */
  options: GroupOption[];
  /** Id of the item currently being moved (shows a spinner on its card). */
  movingId: string | null;
  onMove: (itemId: string, groupId: string | null) => void;
  /** The leaf contract: the page renders one item with its own card. */
  renderItem: (item: T, ctx: LeafContext) => ReactNode;
  getItemId: (item: T) => string;
  /** i18n strings (domain page supplies these from its own namespace). */
  labels: GroupLabels;
  /**
   * Optional: create-top-level-group action, surfaced in the "ungrouped" header
   * only when there are no groups yet (so the user can start grouping). When
   * groups exist the page renders this action in its own toolbar instead.
   */
  onAddGroup?: () => void;
}

/** A responsive grid of leaf cards, or an empty hint. Domain-agnostic. */
function LeafGrid<T>({
  items,
  options,
  movingId,
  onMove,
  renderItem,
  getItemId,
  emptyText,
}: {
  items: T[];
  options: GroupOption[];
  movingId: string | null;
  onMove: (itemId: string, groupId: string | null) => void;
  renderItem: (item: T, ctx: LeafContext) => ReactNode;
  getItemId: (item: T) => string;
  emptyText: string;
}) {
  if (items.length === 0) {
    if (!emptyText) return null;
    return <p className="px-1 py-3 text-sm text-muted-foreground">{emptyText}</p>;
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => {
        const id = getItemId(item);
        return (
          <div key={id}>
            {renderItem(item, {
              options,
              moving: movingId === id,
              onMove: (groupId) => onMove(id, groupId),
            })}
          </div>
        );
      })}
    </div>
  );
}

/** Header row: count badge + per-node actions sitting beside the accordion trigger. */
function NodeHeader({
  node,
  count,
  actions,
  canAddChild,
  labels,
}: {
  node: GroupNode;
  count: number;
  actions: GroupActions;
  canAddChild: boolean;
  labels: GroupLabels;
}) {
  return (
    <div className="flex items-center gap-1 border-b border-border">
      <AccordionTrigger className="flex-1 py-3 font-display text-base font-semibold no-underline hover:no-underline">
        <span className="flex items-baseline gap-2">
          {nodeLabel(node)}
          <span className="text-sm font-normal text-muted-foreground">{count}</span>
        </span>
      </AccordionTrigger>
      <div className="flex shrink-0 items-center">
        {canAddChild && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            aria-label={labels.addSubgroup}
            onClick={() => actions.onAddSubgroup(node)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground"
          aria-label={labels.rename}
          onClick={() => actions.onRename(node)}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          aria-label={labels.delete}
          onClick={() => actions.onDelete(node)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

/** One top-level group: its direct items, then a nested accordion of subgroups. */
function GroupSection<T>({
  group,
  itemsByGroup,
  open,
  onOpenChange,
  movingId,
  onMove,
  actions,
  renderItem,
  getItemId,
  options,
  labels,
}: {
  group: GroupNode;
  itemsByGroup: Map<string, T[]>;
  open: string[];
  onOpenChange: (next: string[]) => void;
  movingId: string | null;
  onMove: (itemId: string, groupId: string | null) => void;
  actions: GroupActions;
  renderItem: (item: T, ctx: LeafContext) => ReactNode;
  getItemId: (item: T) => string;
  options: GroupOption[];
  labels: GroupLabels;
}) {
  const children = group.children ?? [];
  const directItems = itemsByGroup.get(group.id) ?? [];

  // The nested subgroup accordion is its own Radix root, so it only knows about
  // this group's child ids. Scope its value to those ids, and on change merge
  // back into the shared open list — otherwise toggling a subgroup would wipe
  // every other open node from the persisted state.
  const childIds = new Set(children.map((c) => c.id));
  const childOpen = open.filter((id) => childIds.has(id));
  const onChildOpenChange = (nextChildOpen: string[]) => {
    onOpenChange([...open.filter((id) => !childIds.has(id)), ...nextChildOpen]);
  };

  return (
    <AccordionItem value={group.id} className="border-b-0">
      <NodeHeader node={group} count={totalItems(group)} actions={actions} canAddChild labels={labels} />
      <AccordionContent className="pb-4 pl-1 pt-3">
        {/* Items attached directly to the top-level group (no subgroup). */}
        {directItems.length > 0 && (
          <div className="mb-4">
            <LeafGrid
              items={directItems}
              options={options}
              movingId={movingId}
              onMove={onMove}
              renderItem={renderItem}
              getItemId={getItemId}
              emptyText=""
            />
          </div>
        )}

        {children.length > 0 ? (
          <Accordion type="multiple" value={childOpen} onValueChange={onChildOpenChange} className="flex flex-col gap-1">
            {children.map((child) => (
              <AccordionItem key={child.id} value={child.id} className="border-b-0">
                <NodeHeader node={child} count={child.itemCount} actions={actions} canAddChild={false} labels={labels} />
                <AccordionContent className="pb-3 pl-1 pt-3">
                  <LeafGrid
                    items={itemsByGroup.get(child.id) ?? []}
                    options={options}
                    movingId={movingId}
                    onMove={onMove}
                    renderItem={renderItem}
                    getItemId={getItemId}
                    emptyText={labels.emptySubgroup}
                  />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        ) : (
          directItems.length === 0 && <p className="px-1 text-sm text-muted-foreground">{labels.emptyGroup}</p>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}

/**
 * Generic grouped host: a multi-open accordion of top-level groups (each with
 * direct items + a nested subgroup accordion) followed by an "ungrouped" section.
 * Domain-agnostic — the page supplies the tree, the per-leaf items, and a
 * `renderItem` callback that draws one card. Carries the vocab page's nested-Radix
 * open-merge behavior verbatim.
 */
export function GroupedAccordion<T>({
  groups,
  itemsByGroup,
  ungrouped,
  open,
  onOpenChange,
  actions,
  options,
  movingId,
  onMove,
  renderItem,
  getItemId,
  labels,
  onAddGroup,
}: GroupedAccordionProps<T>) {
  const hasGroups = groups.length > 0;

  return (
    <div className="flex flex-col gap-2">
      {hasGroups && (
        <Accordion type="multiple" value={open} onValueChange={onOpenChange} className="flex flex-col gap-2">
          {groups.map((group) => (
            <GroupSection
              key={group.id}
              group={group}
              itemsByGroup={itemsByGroup}
              options={options}
              open={open}
              onOpenChange={onOpenChange}
              movingId={movingId}
              onMove={onMove}
              actions={actions}
              renderItem={renderItem}
              getItemId={getItemId}
              labels={labels}
            />
          ))}
        </Accordion>
      )}

      {ungrouped.length > 0 && (
        <section className={cn(hasGroups && 'mt-6')}>
          <div className="mb-3 flex items-baseline gap-2 border-b border-border pb-3">
            <h2 className="font-display text-base font-semibold">{labels.ungrouped}</h2>
            <span className="text-sm text-muted-foreground">{ungrouped.length}</span>
            {!hasGroups && onAddGroup && (
              <Button variant="outline" size="sm" className="ml-auto gap-1.5" onClick={onAddGroup}>
                <Plus className="h-4 w-4" /> {labels.addGroup}
              </Button>
            )}
          </div>
          <LeafGrid
            items={ungrouped}
            options={options}
            movingId={movingId}
            onMove={onMove}
            renderItem={renderItem}
            getItemId={getItemId}
            emptyText=""
          />
        </section>
      )}
    </div>
  );
}
