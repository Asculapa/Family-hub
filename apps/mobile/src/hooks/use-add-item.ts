import { findDuplicate, normalizeTitle } from '@family-hub/core';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { useAllItems } from '@/hooks/use-lists';
import { choose } from '@/lib/choose';
import { useSync } from '@/providers/sync-provider';

/** Adds an item to a list, asking first when it's already on it (FR-3.6). */
export function useAddItem(listId: string, shopping: boolean) {
  const { t } = useTranslation();
  const { actions } = useSync();
  const allItems = useAllItems();

  return useCallback(
    async (title: string, suggestedCategory: string | null) => {
      const items = allItems.filter((i) => i.list_id === listId && !i.deleted_at);
      const duplicate = findDuplicate(items, listId, title);
      if (duplicate) {
        const choice = await choose(
          t('lists.duplicate.title'),
          t('lists.duplicate.message', { title: duplicate.title }),
          [
            { label: t('common.cancel'), value: 'cancel' as const, style: 'cancel' },
            ...(shopping ? [{ label: t('lists.duplicate.increase'), value: 'increase' as const }] : []),
            { label: t('lists.duplicate.addAnyway'), value: 'add' as const },
          ],
        );
        if (choice === 'increase') return actions.increaseQuantity(duplicate);
        if (choice === 'cancel') return;
      }
      // Reuse the category this item had last time.
      const key = normalizeTitle(title);
      const previous = allItems
        .filter((i) => i.category_id && normalizeTitle(i.title) === key)
        .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
      await actions.addItem({
        listId,
        title,
        categoryId: shopping ? (suggestedCategory ?? previous?.category_id ?? null) : null,
      });
    },
    [actions, allItems, listId, shopping, t],
  );
}
