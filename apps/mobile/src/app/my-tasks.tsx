import { isOverdue } from '@family-hub/core';
import type { ListItemRow } from '@family-hub/data';
import { router } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';

import { ItemRow } from '@/components/lists/item-row';
import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useAllItems, useLists } from '@/hooks/use-lists';
import { useNow } from '@/hooks/use-now';
import { tapFeedback } from '@/lib/haptics';
import { useUserId } from '@/providers/session-provider';
import { useSync } from '@/providers/sync-provider';

/** Everything assigned to me across lists, soonest due first (FR-4.4). */
export default function MyTasksScreen() {
  const { t } = useTranslation();
  const userId = useUserId();
  const { actions } = useSync();
  const items = useAllItems();
  const now = useNow();
  const lists = useLists();

  const listNames = useMemo(() => new Map(lists.map((l) => [l.id, l.name])), [lists]);
  const mine = useMemo(
    () =>
      items
        .filter((i) => i.assignee_id === userId && !i.is_done && !i.deleted_at && listNames.has(i.list_id))
        .sort((a, b) => (a.due_at ?? '￿').localeCompare(b.due_at ?? '￿')),
    [items, userId, listNames],
  );

  const onToggle = useCallback(
    (item: ListItemRow) => {
      tapFeedback();
      void actions.setDone(item, true);
    },
    [actions],
  );
  const onEdit = useCallback(
    (item: ListItemRow) => router.push({ pathname: '/item/[id]', params: { id: item.id } }),
    [],
  );

  return (
    <Screen modal>
      {mine.length === 0 ? <ThemedText themeColor="textSecondary">{t('lists.myTasksEmpty')}</ThemedText> : null}
      {mine.length > 0 ? (
        <Card style={styles.card}>
          {mine.map((item) => (
            <ItemRow
              now={now}
              key={item.id}
              item={item}
              overdue={isOverdue(item, now)}
              context={listNames.get(item.list_id)}
              onToggle={onToggle}
              onEdit={onEdit}
              inset={Spacing.three}
            />
          ))}
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden', paddingVertical: Spacing.one },
});
