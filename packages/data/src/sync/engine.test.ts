import { createMemoryStore } from '@family-hub/storage';
import { beforeEach, describe, expect, it } from 'vitest';

import { AppError } from '../errors';
import { createSyncEngine } from './engine';
import type { ListItemRow, SyncRemote, SyncTable } from './types';

const FAMILY = 'f1';
type Row = { id: string; updated_at: string } & Record<string, unknown>;

/** In-memory stand-in for Supabase with a controllable network. */
function fakeServer() {
  const tables = new Map<SyncTable, Map<string, Row>>();
  let clock = 0;
  const server = {
    offline: false,
    reject: null as null | ((table: SyncTable, row: Record<string, unknown>) => boolean),
    calls: [] as string[],
    table: (t: SyncTable) => tables.get(t) ?? tables.set(t, new Map()).get(t)!,
    stamp: () => new Date(Date.UTC(2026, 8, 28, 12, 0, ++clock)).toISOString(),
    /** Simulates another member's write. */
    write(t: SyncTable, row: Record<string, unknown> & { id: string }) {
      const saved = { ...server.table(t).get(row.id), ...row, updated_at: server.stamp() } as Row;
      server.table(t).set(row.id, saved);
      return saved;
    },
  };
  const net = () => {
    if (server.offline) throw new AppError('network');
  };
  const remote: SyncRemote = {
    async pull(t, familyId, since) {
      net();
      return [...server.table(t).values()]
        .filter((r) => r.family_id === familyId && (!since || r.updated_at > since))
        .sort((a, b) => a.updated_at.localeCompare(b.updated_at));
    },
    async insert(t, row) {
      net();
      server.calls.push(`insert ${row.title ?? row.id}`);
      if (server.reject?.(t, row)) throw new AppError('notAllowed');
      return server.write(t, { deleted_at: null, ...(row as Row), created_at: 'server', done_at: null });
    },
    async update(t, id, patch) {
      net();
      server.calls.push(`update ${JSON.stringify(patch)}`);
      if (server.reject?.(t, patch)) throw new AppError('notAllowed');
      const done = patch.is_done === true ? { done_at: 'server-time' } : {};
      return server.write(t, { id, ...patch, ...done });
    },
    async fetch(t, id) {
      net();
      return server.table(t).get(id) ?? null;
    },
  };
  return { server, remote };
}

let ids = 0;
const newId = () => `id-${++ids}`;

const item = (title: string, extra: Partial<ListItemRow> = {}): ListItemRow => ({
  id: newId(),
  list_id: 'l1',
  family_id: FAMILY,
  title,
  quantity: null,
  unit: null,
  category_id: null,
  note: null,
  assignee_id: null,
  due_at: null,
  is_done: false,
  done_by: null,
  done_at: null,
  position: 0,
  created_by: 'u1',
  created_at: 'local',
  updated_at: 'local',
  deleted_at: null,
  ...extra,
});

describe('sync engine', () => {
  let fake: ReturnType<typeof fakeServer>;
  let store: ReturnType<typeof createMemoryStore>;
  const make = () => createSyncEngine({ store, remote: fake.remote, familyId: FAMILY, newId });

  beforeEach(() => {
    fake = fakeServer();
    store = createMemoryStore();
  });

  it('shows writes immediately and sends them in order', async () => {
    const engine = make();
    await engine.start();
    const milk = item('Milk');
    await engine.insert('list_items', milk);
    await engine.update('list_items', milk.id, { is_done: true }, { done_at: 'local-time' });

    expect(engine.get('list_items', milk.id)).toMatchObject({ is_done: true, done_at: 'local-time' });
    await engine.flush();
    expect(fake.server.calls).toEqual(['insert Milk', 'update {"is_done":true}']);
    expect(engine.get('list_items', milk.id)).toMatchObject({ is_done: true, done_at: 'server-time' });
    expect(engine.pendingCount()).toBe(0);
  });

  it('keeps writes queued while offline and sends them later (FR-3.8)', async () => {
    fake.server.offline = true;
    const engine = make();
    await engine.start();
    await engine.insert('list_items', item('Bread'));
    await engine.insert('list_items', item('Eggs'));
    await engine.flush();
    expect(engine.pendingCount()).toBe(2);
    expect(engine.rows('list_items').map((r) => r.title)).toEqual(['Bread', 'Eggs']);

    // The app restarts while still offline: the queue survives.
    const restarted = make();
    await restarted.start();
    expect(restarted.pendingCount()).toBe(2);

    fake.server.offline = false;
    await restarted.sync();
    expect(fake.server.calls).toEqual(['insert Bread', 'insert Eggs']);
    expect(restarted.pendingCount()).toBe(0);
  });

  it('reverts a write the server rejects', async () => {
    const engine = make();
    await engine.start();
    const milk = item('Milk');
    await engine.insert('list_items', milk);
    await engine.flush();

    fake.server.reject = (_, patch) => 'deleted_at' in patch;
    const rejected: string[] = [];
    const withHandler = createSyncEngine({
      store,
      remote: fake.remote,
      familyId: FAMILY,
      newId,
      onRejected: (e) => rejected.push(e.code),
    });
    await withHandler.start();
    await withHandler.update('list_items', milk.id, { deleted_at: 'now' });
    await withHandler.flush();
    expect(rejected).toEqual(['notAllowed']);
    expect(withHandler.get('list_items', milk.id)?.deleted_at).toBeNull();
  });

  it('hides a rejected insert', async () => {
    fake.server.reject = (t) => t === 'lists';
    const engine = make();
    await engine.start();
    await engine.insert('lists', {
      id: 'list-x',
      family_id: FAMILY,
      name: 'Kid list',
      type: 'shopping',
      position: 0,
      created_by: 'u1',
      archived_at: null,
      created_at: 'local',
      updated_at: 'local',
      deleted_at: null,
    });
    await engine.flush();
    expect(engine.get('lists', 'list-x')?.deleted_at).not.toBeNull();
  });

  it("pulls other members' changes and keeps unsent local edits on top", async () => {
    const engine = make();
    await engine.start();
    const milk = fake.server.write('list_items', item('Milk'));
    await engine.pull();
    expect(engine.get('list_items', milk.id)?.title).toBe('Milk');

    fake.server.offline = true;
    await engine.update('list_items', milk.id, { is_done: true });
    // Someone else renames it; the change arrives by realtime.
    const renamed = fake.server.write('list_items', { id: milk.id, title: 'Oat milk' });
    await engine.applyRemote('list_items', renamed as unknown as ListItemRow);
    expect(engine.get('list_items', milk.id)).toMatchObject({ title: 'Oat milk', is_done: true });
  });

  it('ignores realtime copies older than what it has seen', async () => {
    const engine = make();
    await engine.start();
    const first = fake.server.write('list_items', item('Milk'));
    const second = fake.server.write('list_items', { id: first.id, title: 'Milk 2' });
    await engine.applyRemote('list_items', second as unknown as ListItemRow);
    await engine.applyRemote('list_items', first as unknown as ListItemRow);
    expect(engine.get('list_items', first.id)?.title).toBe('Milk 2');
  });

  it('pulls only rows changed since the last pull', async () => {
    const engine = make();
    await engine.start();
    fake.server.write('list_items', item('A'));
    await engine.pull();
    const pulls: (string | null)[] = [];
    const pull = fake.remote.pull;
    fake.remote.pull = async (t, f, since) => {
      if (t === 'list_items') pulls.push(since);
      return pull(t, f, since);
    };
    await engine.pull();
    expect(pulls[0]).not.toBeNull();
  });

  it('starts empty when the family changes', async () => {
    const engine = make();
    await engine.start();
    await engine.insert('list_items', item('Milk'));
    const other = createSyncEngine({ store, remote: fake.remote, familyId: 'f2', newId });
    await other.start();
    expect(other.rows('list_items')).toEqual([]);
    expect(other.pendingCount()).toBe(0);
  });

  it('notifies subscribers and keeps snapshots stable between changes', async () => {
    const engine = make();
    await engine.start();
    let calls = 0;
    engine.subscribe(() => calls++);
    const before = engine.rows('list_items');
    expect(engine.rows('list_items')).toBe(before);
    fake.server.offline = true;
    await engine.insert('list_items', item('Milk'));
    expect(calls).toBeGreaterThan(0);
    expect(engine.rows('list_items')).not.toBe(before);
  });
});
