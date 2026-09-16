import type { LocalStore, OutboxEntry, Row } from './types';

/** In-memory LocalStore for tests and prototyping. */
export function createMemoryStore(): LocalStore {
  const tables = new Map<string, Map<string, Row>>();
  let outbox: OutboxEntry[] = [];
  const meta = new Map<string, string>();

  const table = (name: string) => {
    let t = tables.get(name);
    if (!t) tables.set(name, (t = new Map()));
    return t;
  };

  return {
    async get<T extends Row>(name: string, id: string) {
      return table(name).get(id) as T | undefined;
    },
    async all<T extends Row>(name: string) {
      return [...table(name).values()] as T[];
    },
    async upsert(name, rows) {
      const t = table(name);
      for (const row of rows) t.set(row.id, row);
    },
    async enqueue(entry) {
      outbox.push(entry);
    },
    async pending() {
      return [...outbox];
    },
    async ack(ids) {
      const done = new Set(ids);
      outbox = outbox.filter((e) => !done.has(e.id));
    },
    async getMeta(key) {
      return meta.get(key);
    },
    async setMeta(key, value) {
      meta.set(key, value);
    },
  };
}
