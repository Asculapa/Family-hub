import { normalizeTitle } from '@family-hub/core';
import { useEffect, useMemo, useState } from 'react';

import { useAllItems, useLists } from '@/hooks/use-lists';
import { repos } from '@/lib/supabase';
import { useSync } from '@/providers/sync-provider';

export interface Suggestion {
  title: string;
  categoryId: string | null;
}

const LIMIT = 6;

/**
 * FR-3.5: past items matching the typed text. Local history answers
 * instantly and offline; the server's longer history is merged in when online.
 */
export function useSuggestions(listId: string, text: string): Suggestion[] {
  const { engine } = useSync();
  const items = useAllItems();
  const lists = useLists();
  const prefix = normalizeTitle(text);
  const [remote, setRemote] = useState<{ prefix: string; rows: Suggestion[] }>({ prefix: '', rows: [] });

  const onList = useMemo(
    () =>
      new Set(
        items
          .filter((i) => i.list_id === listId && !i.is_done && !i.deleted_at)
          .map((i) => normalizeTitle(i.title)),
      ),
    [items, listId],
  );

  const local = useMemo(() => {
    if (!prefix) return [];
    const shopping = new Set(lists.filter((l) => l.type === 'shopping').map((l) => l.id));
    const seen = new Map<string, Suggestion & { count: number; last: string }>();
    for (const i of items) {
      if (!shopping.has(i.list_id)) continue;
      const key = normalizeTitle(i.title);
      if (!key.startsWith(prefix)) continue;
      const s = seen.get(key);
      if (s) {
        s.count++;
        if (i.created_at > s.last) Object.assign(s, { last: i.created_at, categoryId: i.category_id ?? s.categoryId });
      } else {
        seen.set(key, { title: i.title.trim(), categoryId: i.category_id, count: 1, last: i.created_at });
      }
    }
    return [...seen.values()].sort((a, b) => b.count - a.count || b.last.localeCompare(a.last));
  }, [items, lists, prefix]);

  useEffect(() => {
    if (!prefix) return;
    const timer = setTimeout(() => {
      repos
        .suggestItems(engine.familyId, prefix)
        .then((rows) => setRemote({ prefix, rows: rows.map((r) => ({ title: r.title, categoryId: r.category_id })) }))
        .catch(() => {});
    }, 250);
    return () => clearTimeout(timer);
  }, [prefix, engine.familyId]);

  return useMemo(() => {
    if (!prefix) return [];
    const merged = new Map<string, Suggestion>();
    const fromServer = remote.prefix && prefix.startsWith(remote.prefix) ? remote.rows : [];
    for (const s of [...local, ...fromServer]) {
      const key = normalizeTitle(s.title);
      if (key.startsWith(prefix) && key !== prefix && !onList.has(key) && !merged.has(key)) {
        merged.set(key, { title: s.title, categoryId: s.categoryId });
      }
    }
    return [...merged.values()].slice(0, LIMIT);
  }, [local, remote, prefix, onList]);
}
