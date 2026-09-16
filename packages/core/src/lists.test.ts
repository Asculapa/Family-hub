import { describe, expect, it } from 'vitest';

import { findDuplicate, groupItems, isOverdue, normalizeTitle, type ItemLike } from './lists';

const NOW = Date.parse('2026-09-28T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW - h * 3600_000).toISOString();

let n = 0;
const item = (overrides: Partial<ItemLike>): ItemLike => ({
  id: `i${++n}`,
  list_id: 'l1',
  title: 'Item',
  category_id: null,
  is_done: false,
  done_at: null,
  due_at: null,
  assignee_id: null,
  position: n,
  created_at: hoursAgo(100 - n),
  deleted_at: null,
  ...overrides,
});

const produce = { id: 'c1', name: 'Produce', position: 1, deleted_at: null };
const dairy = { id: 'c2', name: 'Dairy', position: 2, deleted_at: null };

describe('normalizeTitle', () => {
  it('ignores case and extra spaces', () => {
    expect(normalizeTitle('  Oat   MILK ')).toBe('oat milk');
  });
});

describe('findDuplicate', () => {
  it('finds an open item with the same name on the same list', () => {
    const milk = item({ title: 'Milk' });
    const items = [milk, item({ title: 'milk', is_done: true }), item({ title: 'Milk', list_id: 'l2' })];
    expect(findDuplicate(items, 'l1', ' MILK')).toBe(milk);
    expect(findDuplicate(items, 'l1', 'Bread')).toBeUndefined();
  });

  it('ignores deleted items', () => {
    expect(findDuplicate([item({ title: 'Milk', deleted_at: hoursAgo(1) })], 'l1', 'Milk')).toBeUndefined();
  });
});

describe('groupItems', () => {
  it('groups open items by category order with uncategorized last', () => {
    const apple = item({ title: 'Apple', category_id: 'c1' });
    const milk = item({ title: 'Milk', category_id: 'c2' });
    const soap = item({ title: 'Soap' });
    const { open } = groupItems([soap, milk, apple], [dairy, produce], NOW);
    expect(open.map((s) => [s.category?.name ?? null, s.items.map((i) => i.title)])).toEqual([
      ['Produce', ['Apple']],
      ['Dairy', ['Milk']],
      [null, ['Soap']],
    ]);
  });

  it('shows done items from the last 24 hours, newest first', () => {
    const old = item({ title: 'Old', is_done: true, done_at: hoursAgo(25) });
    const earlier = item({ title: 'Earlier', is_done: true, done_at: hoursAgo(5) });
    const recent = item({ title: 'Recent', is_done: true, done_at: hoursAgo(1) });
    const { done } = groupItems([old, earlier, recent], [], NOW);
    expect(done.map((i) => i.title)).toEqual(['Recent', 'Earlier']);
  });

  it('can skip category grouping for to-do lists', () => {
    const { open } = groupItems([item({ category_id: 'c1' }), item({})], [produce], NOW, { byCategory: false });
    expect(open).toHaveLength(1);
    expect(open[0]!.category).toBeNull();
  });
});

describe('isOverdue', () => {
  it('flags open items past their due time', () => {
    expect(isOverdue(item({ due_at: hoursAgo(1) }), NOW)).toBe(true);
    expect(isOverdue(item({ due_at: hoursAgo(1), is_done: true }), NOW)).toBe(false);
    expect(isOverdue(item({ due_at: hoursAgo(-1) }), NOW)).toBe(false);
  });
});
