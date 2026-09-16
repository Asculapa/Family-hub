import type { SyncEngine } from './sync/engine';
import type { ListItemRow, ListRow, SyncPatch } from './sync/types';

export interface NewItem {
  listId: string;
  title: string;
  categoryId?: string | null;
  quantity?: number | null;
  unit?: string | null;
  note?: string | null;
  assigneeId?: string | null;
  dueAt?: string | null;
}

export type ItemChanges = Pick<
  SyncPatch<'list_items'>,
  'title' | 'quantity' | 'unit' | 'category_id' | 'note' | 'assignee_id' | 'due_at'
>;

/** List and item writes, applied locally first through the sync engine. */
export function createListActions(
  engine: SyncEngine,
  { userId, newId, now = () => new Date() }: { userId: string; newId: () => string; now?: () => Date },
) {
  const familyId = engine.familyId;
  const stamp = () => now().toISOString();

  return {
    async addItem(input: NewItem): Promise<ListItemRow> {
      const t = stamp();
      const row: ListItemRow = {
        id: newId(),
        list_id: input.listId,
        family_id: familyId,
        title: input.title.trim(),
        quantity: input.quantity ?? null,
        unit: input.unit ?? null,
        category_id: input.categoryId ?? null,
        note: input.note ?? null,
        assignee_id: input.assigneeId ?? null,
        due_at: input.dueAt ?? null,
        is_done: false,
        done_by: null,
        done_at: null,
        position: now().getTime(),
        created_by: userId,
        created_at: t,
        updated_at: t,
        deleted_at: null,
      };
      await engine.insert('list_items', row);
      return row;
    },

    setDone(item: Pick<ListItemRow, 'id'>, done: boolean) {
      return engine.update(
        'list_items',
        item.id,
        { is_done: done },
        done ? { done_by: userId, done_at: stamp() } : { done_by: null, done_at: null },
      );
    },

    updateItem(id: string, changes: ItemChanges) {
      return engine.update('list_items', id, changes);
    },

    /** FR-3.6: "Already on the list" → bump the quantity instead. */
    increaseQuantity(item: Pick<ListItemRow, 'id' | 'quantity'>, by = 1) {
      return engine.update('list_items', item.id, { quantity: (item.quantity ?? 1) + by });
    },

    deleteItem(id: string) {
      return engine.update('list_items', id, { deleted_at: stamp() });
    },

    async createList(name: string, type: ListRow['type']): Promise<ListRow> {
      const t = stamp();
      const row: ListRow = {
        id: newId(),
        family_id: familyId,
        name: name.trim(),
        type,
        position: now().getTime(),
        created_by: userId,
        archived_at: null,
        created_at: t,
        updated_at: t,
        deleted_at: null,
      };
      await engine.insert('lists', row);
      return row;
    },

    renameList(id: string, name: string) {
      return engine.update('lists', id, { name: name.trim() });
    },

    archiveList(id: string) {
      return engine.update('lists', id, { archived_at: stamp() });
    },
  };
}

export type ListActions = ReturnType<typeof createListActions>;
