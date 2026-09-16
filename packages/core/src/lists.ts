/** Pure list logic shared by every client (spec sections 4.3, 4.4). */

export const BOUGHT_VISIBLE_MS = 24 * 60 * 60 * 1000;

export interface ItemLike {
  id: string;
  list_id: string;
  title: string;
  category_id: string | null;
  is_done: boolean;
  done_at: string | null;
  due_at: string | null;
  assignee_id: string | null;
  position: number;
  created_at: string;
  deleted_at: string | null;
}

export interface CategoryLike {
  id: string;
  name: string;
  position: number;
  deleted_at: string | null;
}

export function normalizeTitle(title: string): string {
  return title.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

/** An open item on the list with the same name (FR-3.6). */
export function findDuplicate<T extends ItemLike>(items: T[], listId: string, title: string): T | undefined {
  const key = normalizeTitle(title);
  return items.find(
    (i) => i.list_id === listId && !i.deleted_at && !i.is_done && normalizeTitle(i.title) === key,
  );
}

/** Bought items stay visible for 24 hours (FR-3.3). */
export function isVisibleDone(item: ItemLike, now: number): boolean {
  return item.is_done && !!item.done_at && now - Date.parse(item.done_at) < BOUGHT_VISIBLE_MS;
}

export function isOverdue(item: ItemLike, now: number): boolean {
  return !item.is_done && !!item.due_at && Date.parse(item.due_at) < now;
}

const byPosition = (a: ItemLike, b: ItemLike) =>
  a.position - b.position || a.created_at.localeCompare(b.created_at);

export interface ItemSection<T, C> {
  /** null for items without a category. */
  category: C | null;
  items: T[];
}

export interface GroupedItems<T, C> {
  open: ItemSection<T, C>[];
  done: T[];
}

/**
 * Splits a list's items into open items grouped by category (in category
 * order, uncategorized last) and recently done items, newest first.
 */
export function groupItems<T extends ItemLike, C extends CategoryLike>(
  items: T[],
  categories: C[],
  now: number,
  { byCategory = true }: { byCategory?: boolean } = {},
): GroupedItems<T, C> {
  const live = items.filter((i) => !i.deleted_at);
  const open = live.filter((i) => !i.is_done).sort(byPosition);
  const done = live
    .filter((i) => isVisibleDone(i, now))
    .sort((a, b) => (b.done_at ?? '').localeCompare(a.done_at ?? ''));

  if (!byCategory) return { open: open.length ? [{ category: null, items: open }] : [], done };

  const known = categories.filter((c) => !c.deleted_at).sort((a, b) => a.position - b.position);
  const sections: ItemSection<T, C>[] = known
    .map((category) => ({ category, items: open.filter((i) => i.category_id === category.id) }))
    .filter((s) => s.items.length > 0);
  const knownIds = new Set(known.map((c) => c.id));
  const rest = open.filter((i) => !i.category_id || !knownIds.has(i.category_id));
  if (rest.length) sections.push({ category: null, items: rest });
  return { open: sections, done };
}
