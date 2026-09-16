import type { LocalStore, OutboxEntry, Row } from './types';

/** The subset of expo-sqlite's SQLiteDatabase this store needs. */
export interface SqlDatabase {
  execAsync(source: string): Promise<void>;
  runAsync(source: string, ...params: (string | number | null)[]): Promise<unknown>;
  getAllAsync<T>(source: string, ...params: (string | number | null)[]): Promise<T[]>;
  getFirstAsync<T>(source: string, ...params: (string | number | null)[]): Promise<T | null>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}

const SCHEMA = `
  create table if not exists rows (
    tbl text not null,
    id text not null,
    data text not null,
    primary key (tbl, id)
  );
  create table if not exists outbox (
    seq integer primary key autoincrement,
    id text not null unique,
    data text not null
  );
  create table if not exists meta (
    key text primary key,
    value text not null
  );
`;

/**
 * LocalStore on SQLite. Rows are stored as JSON per table; a family's data is
 * small enough that screens filter in memory.
 */
export async function createSqliteStore(db: SqlDatabase): Promise<LocalStore> {
  await db.execAsync(SCHEMA);

  return {
    async get<T extends Row>(table: string, id: string) {
      const row = await db.getFirstAsync<{ data: string }>(
        'select data from rows where tbl = ? and id = ?',
        table,
        id,
      );
      return row ? (JSON.parse(row.data) as T) : undefined;
    },

    async all<T extends Row>(table: string) {
      const rows = await db.getAllAsync<{ data: string }>('select data from rows where tbl = ?', table);
      return rows.map((r) => JSON.parse(r.data) as T);
    },

    async upsert(table, rows) {
      if (rows.length === 0) return;
      await db.withTransactionAsync(async () => {
        for (const row of rows) {
          await db.runAsync(
            'insert into rows (tbl, id, data) values (?, ?, ?) on conflict (tbl, id) do update set data = excluded.data',
            table,
            row.id,
            JSON.stringify(row),
          );
        }
      });
    },

    async enqueue(entry) {
      await db.runAsync('insert into outbox (id, data) values (?, ?)', entry.id, JSON.stringify(entry));
    },

    async pending() {
      const rows = await db.getAllAsync<{ data: string }>('select data from outbox order by seq');
      return rows.map((r) => JSON.parse(r.data) as OutboxEntry);
    },

    async ack(ids) {
      if (ids.length === 0) return;
      await db.runAsync(`delete from outbox where id in (${ids.map(() => '?').join(', ')})`, ...ids);
    },

    async getMeta(key) {
      const row = await db.getFirstAsync<{ value: string }>('select value from meta where key = ?', key);
      return row?.value;
    },

    async setMeta(key, value) {
      await db.runAsync(
        'insert into meta (key, value) values (?, ?) on conflict (key) do update set value = excluded.value',
        key,
        value,
      );
    },

    async clear() {
      await db.execAsync('delete from rows; delete from outbox; delete from meta;');
    },
  };
}
