/// <reference types="node" />
// Runs against a local Supabase stack: `pnpm --filter @family-hub/data test:integration`.
import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createMemoryStore } from '@family-hub/storage';

import { createSupabaseClient } from './client';
import { createCalendarActions, createListActions, createRepositories, createSyncEngine, type Repositories } from './index';

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const memoryStorage = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
};

describe.skipIf(!url || !anonKey || !serviceKey)('accounts and family (integration)', () => {
  const admin = createClient(url!, serviceKey!, { auth: { persistSession: false } });
  const run = Date.now();
  const users: { id: string; repos: Repositories }[] = [];

  async function user(name: string) {
    const email = `${name}-${run}@example.com`;
    const password = 'correct-horse-battery';
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name },
    });
    if (error) throw error;
    const client = createSupabaseClient({ url: url!, anonKey: anonKey!, storage: memoryStorage() });
    const repos = createRepositories(client, 'familyhub://auth/callback');
    await repos.auth.signIn(email, password);
    const u = { id: data.user.id, repos };
    users.push(u);
    return u;
  }

  let owner: Awaited<ReturnType<typeof user>>;
  let adult: Awaited<ReturnType<typeof user>>;
  let child: Awaited<ReturnType<typeof user>>;

  beforeAll(async () => {
    [owner, adult, child] = await Promise.all([user('Olena'), user('Andrii'), user('Kira')]);
  });

  afterAll(async () => {
    await Promise.all(users.map((u) => admin.auth.admin.deleteUser(u.id)));
  });

  it('creates a family and invites members by code and link', async () => {
    expect(await owner.repos.families.getMembership(owner.id)).toBeNull();
    const family = await owner.repos.families.create('Kovalenko');

    const adultInvite = await owner.repos.families.createInvite(family.id, 'adult');
    expect(await adult.repos.families.acceptInvite({ code: adultInvite.code })).toEqual({
      status: 'joined',
      family_id: family.id,
    });

    const childInvite = await adult.repos.families.createInvite(family.id, 'child', 10);
    expect((await child.repos.families.acceptInvite({ token: childInvite.token })).status).toBe('joined');

    const membership = await child.repos.families.getMembership(child.id);
    expect(membership).toMatchObject({ role: 'child', family: { name: 'Kovalenko' } });

    const members = await child.repos.families.listMembers(family.id);
    expect(members.map((m) => [m.displayName, m.role])).toEqual([
      ['Olena', 'owner'],
      ['Andrii', 'adult'],
      ['Kira', 'child'],
    ]);

    expect(await child.repos.families.listInvites(family.id)).toEqual([]);
    const open = await owner.repos.families.listInvites(family.id);
    expect(open.map((i) => i.id)).toEqual([childInvite.id]);
  });

  it('enforces roles and the last-owner rule', async () => {
    const { family } = (await owner.repos.families.getMembership(owner.id))!;

    await expect(adult.repos.families.createInvite(family.id, 'adult')).rejects.toMatchObject({
      code: 'notAllowed',
    });
    await expect(owner.repos.families.removeMember(family.id, owner.id)).rejects.toMatchObject({
      code: 'lastOwner',
    });

    await owner.repos.families.setRole(family.id, adult.id, 'owner');
    await owner.repos.families.removeMember(family.id, owner.id);
    expect(await owner.repos.families.getMembership(owner.id)).toBeNull();
  });

  it('updates the profile', async () => {
    const updated = await child.repos.profiles.update(child.id, { display_name: 'Kira K', color: '#16A34A' });
    expect(updated).toMatchObject({ display_name: 'Kira K', color: '#16A34A' });
  });

  it('requires email confirmation on sign-up', async () => {
    const client = createSupabaseClient({ url: url!, anonKey: anonKey!, storage: memoryStorage() });
    const repos = createRepositories(client, 'familyhub://auth/callback');
    const result = await repos.auth.signUp(`new-${run}@example.com`, 'correct-horse-battery', 'New');
    expect(result).toEqual({ needsConfirmation: true });
    const { data } = await admin.auth.admin.listUsers();
    const created = data.users.find((u) => u.email === `new-${run}@example.com`);
    if (created) users.push({ id: created.id, repos });
  });
});

describe.skipIf(!url || !anonKey || !serviceKey)('lists sync (integration)', () => {
  const admin = createClient(url!, serviceKey!, { auth: { persistSession: false } });
  const run = Date.now();
  const created: string[] = [];

  async function member(name: string) {
    const email = `sync-${name}-${run}@example.com`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: 'correct-horse-battery',
      email_confirm: true,
      user_metadata: { full_name: name },
    });
    if (error) throw error;
    created.push(data.user.id);
    const client = createSupabaseClient({ url: url!, anonKey: anonKey!, storage: memoryStorage() });
    const repos = createRepositories(client, 'familyhub://auth/callback');
    await repos.auth.signIn(email, 'correct-horse-battery');
    return { id: data.user.id, repos };
  }

  afterAll(async () => {
    await Promise.all(created.map((id) => admin.auth.admin.deleteUser(id)));
  });

  it('syncs items between two members and enforces child rules', async () => {
    const owner = await member('owner');
    const child = await member('child');
    const family = await owner.repos.families.create('Syncers');
    const invite = await owner.repos.families.createInvite(family.id, 'child');
    await child.repos.families.acceptInvite({ code: invite.code });

    const device = (m: typeof owner) => {
      const rejected: string[] = [];
      const engine = createSyncEngine({
        store: createMemoryStore(),
        remote: m.repos.syncRemote,
        familyId: family.id,
        newId: () => crypto.randomUUID(),
        onRejected: (e) => rejected.push(e.code),
      });
      const actions = createListActions(engine, { userId: m.id, newId: () => crypto.randomUUID() });
      return { engine, actions, rejected };
    };
    const phone = device(owner);
    const kidPhone = device(child);
    await phone.engine.start();
    await kidPhone.engine.start();
    await phone.engine.sync();

    const groceries = phone.engine.rows('lists').find((l) => l.name === 'Groceries')!;
    const dairy = phone.engine.rows('categories').find((c) => c.name === 'Dairy')!;
    const milk = await phone.actions.addItem({ listId: groceries.id, title: 'Milk', categoryId: dairy.id });
    await phone.engine.flush();
    expect(phone.engine.pendingCount()).toBe(0);

    await kidPhone.engine.sync();
    expect(kidPhone.engine.get('list_items', milk.id)).toMatchObject({ title: 'Milk', created_by: owner.id });

    await kidPhone.actions.setDone(milk, true);
    await kidPhone.engine.flush();
    await phone.engine.sync();
    expect(phone.engine.get('list_items', milk.id)).toMatchObject({ is_done: true, done_by: child.id });

    // A child cannot delete: the server rejects and the item comes back.
    await kidPhone.actions.deleteItem(milk.id);
    expect(kidPhone.engine.get('list_items', milk.id)?.deleted_at).not.toBeNull();
    await kidPhone.engine.flush();
    expect(kidPhone.rejected).toEqual(['notAllowed']);
    expect(kidPhone.engine.get('list_items', milk.id)?.deleted_at).toBeNull();

    expect(await owner.repos.suggestItems(family.id, 'mi')).toEqual([{ title: 'Milk', category_id: dairy.id }]);

    await phone.actions.deleteItem(milk.id);
    await phone.engine.flush();
    await kidPhone.engine.sync();
    expect(kidPhone.engine.get('list_items', milk.id)?.deleted_at).not.toBeNull();

    // Calendar: events sync too, and children can't edit others' events (section 6).
    const cal = createCalendarActions(phone.engine, { userId: owner.id, newId: () => crypto.randomUUID() });
    const kidCal = createCalendarActions(kidPhone.engine, { userId: child.id, newId: () => crypto.randomUUID() });
    const swim = await cal.createEvent({
      title: 'Swim',
      startsAt: '2026-10-05T06:00:00Z',
      endsAt: '2026-10-05T07:00:00Z',
      allDay: false,
      timezone: 'Europe/Kyiv',
      rrule: 'FREQ=WEEKLY;BYDAY=MO',
      participantIds: [child.id],
      locationText: 'Pool',
      note: null,
      reminderMinutes: 60,
    });
    await phone.engine.flush();
    await kidPhone.engine.sync();
    expect(kidPhone.engine.get('events', swim.id)).toMatchObject({ title: 'Swim', participant_ids: [child.id] });

    await kidCal.updateEvent(swim.id, {
      title: 'Hacked',
      startsAt: swim.starts_at,
      endsAt: swim.ends_at,
      allDay: false,
      timezone: 'Europe/Kyiv',
      rrule: swim.rrule,
      participantIds: [child.id],
      locationText: null,
      note: null,
      reminderMinutes: null,
    });
    await kidPhone.engine.flush();
    expect(kidPhone.engine.get('events', swim.id)?.title).toBe('Swim');

    // "This event" edits create an exception that syncs.
    await cal.cancelOccurrence(phone.engine.get('events', swim.id)!, '2026-10-12T06:00:00.000Z');
    await phone.engine.flush();
    await kidPhone.engine.sync();
    expect(kidPhone.engine.rows('event_exceptions')).toMatchObject([{ event_id: swim.id, is_cancelled: true }]);
  });
});
