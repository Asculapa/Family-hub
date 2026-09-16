/// <reference types="node" />
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { createMemoryStore } from './memory';
import { createSqliteStore, type SqlDatabase } from './sqlite';
import type { LocalStore, OutboxEntry } from './types';

/** node:sqlite behind the async expo-sqlite shape. */
function nodeSqlite(): SqlDatabase {
  const db = new DatabaseSync(':memory:');
  return {
    async execAsync(sql) {
      db.exec(sql);
    },
    async runAsync(sql, ...params) {
      return db.prepare(sql).run(...params);
    },
    async getAllAsync<T>(sql: string, ...params: (string | number | null)[]) {
      return db.prepare(sql).all(...params) as T[];
    },
    async getFirstAsync<T>(sql: string, ...params: (string | number | null)[]) {
      return (db.prepare(sql).get(...params) as T | undefined) ?? null;
    },
    async withTransactionAsync(task) {
      db.exec('begin');
      try {
        await task();
        db.exec('commit');
      } catch (e) {
        db.exec('rollback');
        throw e;
      }
    },
  };
}

const entry = (id: string): OutboxEntry => ({
  id,
  table: 'list_items',
  rowId: 'r' + id,
  op: 'update',
  payload: { is_done: true },
  createdAt: id,
});

describe.each([
  ['memory', async () => createMemoryStore()],
  ['sqlite', async () => createSqliteStore(nodeSqlite())],
])('%s store', (_, make: () => Promise<LocalStore>) => {
  it('upserts rows by id per table', async () => {
    const store = await make();
    await store.upsert('lists', [{ id: 'a', updated_at: '1', name: 'Groceries' }]);
    await store.upsert('lists', [{ id: 'a', updated_at: '2', name: 'Food' }]);
    await store.upsert('categories', [{ id: 'a', updated_at: '1' }]);
    expect(await store.all('lists')).toEqual([{ id: 'a', updated_at: '2', name: 'Food' }]);
    expect(await store.get('lists', 'a')).toMatchObject({ name: 'Food' });
    expect(await store.get('lists', 'missing')).toBeUndefined();
  });

  it('keeps the outbox in order and removes acknowledged entries', async () => {
    const store = await make();
    for (const id of ['1', '2', '3']) await store.enqueue(entry(id));
    await store.ack(['2']);
    expect((await store.pending()).map((e) => e.id)).toEqual(['1', '3']);
  });

  it('stores metadata and clears everything', async () => {
    const store = await make();
    await store.setMeta('cursor', 'x');
    await store.setMeta('cursor', 'y');
    expect(await store.getMeta('cursor')).toBe('y');
    await store.upsert('lists', [{ id: 'a', updated_at: '1' }]);
    await store.enqueue(entry('1'));
    await store.clear();
    expect(await store.all('lists')).toEqual([]);
    expect(await store.pending()).toEqual([]);
    expect(await store.getMeta('cursor')).toBeUndefined();
  });
});
