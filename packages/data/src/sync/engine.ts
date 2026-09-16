import type { LocalStore, OutboxEntry } from '@family-hub/storage';

import { toAppError, type AppError } from '../errors';
import { SYNC_TABLES, type SyncPatch, type SyncRemote, type SyncRow, type SyncTable } from './types';

/** Columns the server owns; never sent in writes. */
const SERVER_FIELDS = ['created_at', 'updated_at', 'created_by', 'done_by', 'done_at', 'deleted_at'];

/** Pulls re-read this much before the cursor, to catch transactions that committed late. */
const CURSOR_OVERLAP_MS = 60_000;

export interface SyncEngineOptions {
  store: LocalStore;
  remote: SyncRemote;
  familyId: string;
  newId: () => string;
  now?: () => Date;
  /** Called when the server rejects a queued write; the row has been reverted. */
  onRejected?: (error: AppError, entry: OutboxEntry) => void;
}

type Row = SyncRow & Record<string, unknown>;

/**
 * Offline-first sync (spec section 7): the UI reads from the local cache,
 * writes apply locally first and go through an ordered outbox, and pulls and
 * realtime events bring in other members' changes. Conflicts: last write wins
 * per row, using the server's updated_at.
 */
export function createSyncEngine({ store, remote, familyId, newId, now = () => new Date(), onRejected }: SyncEngineOptions) {
  const cache = new Map<SyncTable, Map<string, Row>>(SYNC_TABLES.map((t) => [t, new Map()]));
  const snapshots = new Map<SyncTable, Row[]>();
  const listeners = new Set<() => void>();
  let outbox: OutboxEntry[] = [];
  // Newest server updated_at seen per row; older copies (late realtime echoes) are ignored.
  const serverVersion = new Map<string, string>();
  let flushing: Promise<void> | null = null;

  const emit = (table: SyncTable) => {
    snapshots.delete(table);
    listeners.forEach((l) => l());
  };

  /** Server row with this device's unsent changes re-applied on top. */
  const rebase = (table: SyncTable, row: Row): Row =>
    outbox
      .filter((e) => e.table === table && e.rowId === row.id && e.op === 'update')
      .reduce<Row>((acc, e) => ({ ...acc, ...e.payload }), row);

  async function apply(table: SyncTable, rows: Row[]) {
    const fresh = rows.filter((r) => {
      const key = `${table}:${r.id}`;
      const seen = serverVersion.get(key);
      if (seen && r.updated_at < seen) return false;
      serverVersion.set(key, r.updated_at);
      return true;
    });
    if (fresh.length === 0) return;
    const merged = fresh.map((r) => rebase(table, r));
    const t = cache.get(table)!;
    for (const r of merged) t.set(r.id, r);
    await store.upsert(table, merged);
    emit(table);
  }

  async function setLocal(table: SyncTable, row: Row) {
    cache.get(table)!.set(row.id, row);
    await store.upsert(table, [row]);
    emit(table);
  }

  async function revert(entry: OutboxEntry) {
    const table = entry.table as SyncTable;
    const fresh = await remote.fetch(table, entry.rowId).catch(() => undefined);
    if (fresh) {
      await apply(table, [fresh as Row]);
    } else if (fresh === null) {
      // The server never accepted the row: hide it locally.
      const local = cache.get(table)!.get(entry.rowId);
      if (local) await setLocal(table, { ...local, deleted_at: now().toISOString() });
    }
  }

  async function runFlush() {
    while (outbox.length > 0) {
      const entry = outbox[0]!;
      const table = entry.table as SyncTable;
      try {
        const saved =
          entry.op === 'insert'
            ? await remote.insert(table, entry.payload)
            : await remote.update(table, entry.rowId, entry.payload);
        outbox.shift();
        await store.ack([entry.id]);
        await apply(table, [saved as Row]);
      } catch (e) {
        const error = toAppError(e);
        if (error.code === 'network') return; // retry on the next flush
        outbox.shift();
        await store.ack([entry.id]);
        await revert(entry);
        onRejected?.(error, entry);
      }
    }
  }

  const engine = {
    familyId,

    /** Loads the local cache; call once before rendering. */
    async start() {
      if ((await store.getMeta('familyId')) !== familyId) {
        await store.clear();
        await store.setMeta('familyId', familyId);
      }
      for (const table of SYNC_TABLES) {
        const t = cache.get(table)!;
        for (const row of await store.all<Row>(table)) t.set(row.id, row);
        emit(table);
      }
      outbox = await store.pending();
    },

    /** Sends queued writes, then pulls changes. Network errors are left for the next call. */
    async sync() {
      await engine.flush();
      await engine.pull().catch((e) => {
        if (toAppError(e).code !== 'network') throw e;
      });
    },

    async pull(tables: readonly SyncTable[] = SYNC_TABLES) {
      for (const table of tables) {
        const key = `cursor:${table}`;
        const cursor = await store.getMeta(key);
        const since = cursor ? new Date(Date.parse(cursor) - CURSOR_OVERLAP_MS).toISOString() : null;
        const rows = (await remote.pull(table, familyId, since)) as Row[];
        await apply(table, rows);
        const newest = rows.reduce((max, r) => (r.updated_at > max ? r.updated_at : max), cursor ?? '');
        if (newest) await store.setMeta(key, newest);
      }
    },

    flush(): Promise<void> {
      flushing ??= runFlush().finally(() => {
        flushing = null;
      });
      return flushing;
    },

    /** A row pushed by realtime. */
    applyRemote(table: SyncTable, row: SyncRow) {
      return apply(table, [row as Row]);
    },

    /** Creates a row locally and queues it. `row` is the full local row. */
    async insert<T extends SyncTable>(table: T, row: SyncRow<T>) {
      const payload = Object.fromEntries(
        Object.entries(row).filter(([k]) => !SERVER_FIELDS.includes(k)),
      );
      const entry: OutboxEntry = {
        id: newId(),
        table,
        rowId: row.id,
        op: 'insert',
        payload,
        createdAt: now().toISOString(),
      };
      outbox.push(entry);
      await store.enqueue(entry);
      await setLocal(table, row as Row);
      void engine.flush();
    },

    /**
     * Changes a row locally and queues the patch. `local` holds fields the
     * server derives (e.g. done_at) so the UI shows them before the round trip.
     */
    async update<T extends SyncTable>(table: T, id: string, patch: SyncPatch<T>, local: Partial<SyncRow<T>> = {}) {
      const current = cache.get(table)!.get(id);
      if (!current) throw new Error(`No ${table} row ${id}`);
      const entry: OutboxEntry = {
        id: newId(),
        table,
        rowId: id,
        op: 'update',
        payload: patch as Record<string, unknown>,
        createdAt: now().toISOString(),
      };
      outbox.push(entry);
      await store.enqueue(entry);
      await setLocal(table, { ...current, ...patch, ...local, updated_at: now().toISOString() } as Row);
      void engine.flush();
    },

    get<T extends SyncTable>(table: T, id: string): SyncRow<T> | undefined {
      return cache.get(table)!.get(id) as SyncRow<T> | undefined;
    },

    /** All local rows of a table, including soft-deleted ones. Stable until the table changes. */
    rows<T extends SyncTable>(table: T): SyncRow<T>[] {
      let snap = snapshots.get(table);
      if (!snap) {
        snap = [...cache.get(table)!.values()];
        snapshots.set(table, snap);
      }
      return snap as SyncRow<T>[];
    },

    pendingCount: () => outbox.length,

    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };

  return engine;
}

export type SyncEngine = ReturnType<typeof createSyncEngine>;
