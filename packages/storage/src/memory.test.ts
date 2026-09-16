import { describe, expect, it } from 'vitest';

import { createMemoryStore } from './memory';

describe('memory store', () => {
  it('upserts rows by id', async () => {
    const store = createMemoryStore();
    await store.upsert('lists', [{ id: 'a', updated_at: '1', name: 'Groceries' }]);
    await store.upsert('lists', [{ id: 'a', updated_at: '2', name: 'Food' }]);
    expect(await store.all('lists')).toEqual([{ id: 'a', updated_at: '2', name: 'Food' }]);
  });

  it('keeps the outbox in order and removes acknowledged entries', async () => {
    const store = createMemoryStore();
    const entry = (id: string) => ({
      id,
      table: 'list_items',
      op: 'upsert' as const,
      payload: {},
      createdAt: id,
    });
    await store.enqueue(entry('1'));
    await store.enqueue(entry('2'));
    await store.enqueue(entry('3'));
    await store.ack(['2']);
    expect((await store.pending()).map((e) => e.id)).toEqual(['1', '3']);
  });
});
