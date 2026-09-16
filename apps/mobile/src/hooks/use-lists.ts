import type { CategoryRow, ListItemRow, ListRow, SyncTable } from '@family-hub/data';
import { useMemo, useSyncExternalStore } from 'react';

import { useSync } from '@/providers/sync-provider';

function useTable<T extends SyncTable>(table: T) {
  const { engine } = useSync();
  return useSyncExternalStore(engine.subscribe, () => engine.rows(table));
}

/** Active lists in display order. */
export function useLists(): ListRow[] {
  const lists = useTable('lists');
  return useMemo(
    () => lists.filter((l) => !l.deleted_at && !l.archived_at).sort((a, b) => a.position - b.position),
    [lists],
  );
}

export function useList(id: string): ListRow | undefined {
  const lists = useTable('lists');
  return useMemo(() => lists.find((l) => l.id === id), [lists, id]);
}

/** All items, including done and deleted ones; filter per screen. */
export function useAllItems(): ListItemRow[] {
  return useTable('list_items');
}

export function useItems(listId: string): ListItemRow[] {
  const items = useTable('list_items');
  return useMemo(() => items.filter((i) => i.list_id === listId && !i.deleted_at), [items, listId]);
}

export function useItem(id: string): ListItemRow | undefined {
  const items = useTable('list_items');
  return useMemo(() => items.find((i) => i.id === id), [items, id]);
}

export function useCategories(): CategoryRow[] {
  const categories = useTable('categories');
  return useMemo(
    () => categories.filter((c) => !c.deleted_at).sort((a, b) => a.position - b.position),
    [categories],
  );
}

export function usePendingCount(): number {
  const { engine } = useSync();
  return useSyncExternalStore(engine.subscribe, engine.pendingCount);
}
