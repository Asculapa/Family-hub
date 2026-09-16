/**
 * Platform-neutral local database (spec section 8). The native app backs it
 * with expo-sqlite; the v2 web app will back it with IndexedDB.
 */
export interface Row {
  id: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface OutboxEntry {
  /** Client-generated UUID; makes the server write idempotent. */
  id: string;
  table: string;
  op: 'upsert' | 'delete';
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface LocalStore {
  get<T extends Row>(table: string, id: string): Promise<T | undefined>;
  all<T extends Row>(table: string): Promise<T[]>;
  upsert<T extends Row>(table: string, rows: T[]): Promise<void>;

  enqueue(entry: OutboxEntry): Promise<void>;
  /** Oldest first, so writes replay in order. */
  pending(): Promise<OutboxEntry[]>;
  ack(ids: string[]): Promise<void>;

  getMeta(key: string): Promise<string | undefined>;
  setMeta(key: string, value: string): Promise<void>;
}
