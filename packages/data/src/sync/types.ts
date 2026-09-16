import type { Database } from '../database.types';

export const SYNC_TABLES = ['lists', 'categories', 'list_items', 'events', 'event_exceptions'] as const;
export type SyncTable = (typeof SYNC_TABLES)[number];

type Tables = Database['public']['Tables'];
export type SyncRow<T extends SyncTable = SyncTable> = Tables[T]['Row'];
export type SyncPatch<T extends SyncTable = SyncTable> = Partial<Tables[T]['Update']>;

export type ListRow = SyncRow<'lists'>;
export type CategoryRow = SyncRow<'categories'>;
export type ListItemRow = SyncRow<'list_items'>;
export type EventRow = SyncRow<'events'>;
export type EventExceptionRow = SyncRow<'event_exceptions'>;

type AnyRow = { id: string; updated_at: string } & Record<string, unknown>;

/** Server side of sync; the Supabase implementation lives in ./remote. */
export interface SyncRemote {
  /** Rows of a family changed after `since` (all rows when null), oldest change first. */
  pull(table: SyncTable, familyId: string, since: string | null): Promise<AnyRow[]>;
  insert(table: SyncTable, row: Record<string, unknown>): Promise<AnyRow>;
  update(table: SyncTable, id: string, patch: Record<string, unknown>): Promise<AnyRow>;
  /** The current server row, or null if it doesn't exist or isn't visible. */
  fetch(table: SyncTable, id: string): Promise<AnyRow | null>;
}
