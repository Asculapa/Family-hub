import { can, groupItems, isOverdue } from '@family-hub/core';
import type { ListItemRow } from '@family-hub/data';
import { FlashList } from '@shopify/flash-list';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddItemBar } from '@/components/lists/add-item-bar';
import { ItemRow } from '@/components/lists/item-row';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { Spacing } from '@/constants/theme';
import { useFamily } from '@/hooks/queries';
import { useAddItem } from '@/hooks/use-add-item';
import { useCategories, useItems, useList, usePendingCount } from '@/hooks/use-lists';
import { useMemberNames } from '@/hooks/use-member-names';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { confirm } from '@/lib/confirm';
import { tapFeedback } from '@/lib/haptics';
import { useSync } from '@/providers/sync-provider';

type Row =
  | { type: 'section'; key: string; title: string }
  | { type: 'item'; key: string; item: ListItemRow }
  | { type: 'done'; key: string; count: number };

export default function ListScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { role } = useFamily();
  const { engine, actions } = useSync();
  const list = useList(id);
  const items = useItems(id);
  const categories = useCategories();
  const names = useMemberNames();
  const pending = usePendingCount();
  const [showDone, setShowDone] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const now = useNow();

  const shopping = list?.type === 'shopping';
  const canDelete = can(role, 'item.delete');

  const rows = useMemo<Row[]>(() => {
    const grouped = groupItems(items, categories, now, { byCategory: shopping });
    const out: Row[] = [];
    for (const section of grouped.open) {
      if (shopping) {
        out.push({
          type: 'section',
          key: `s-${section.category?.id ?? 'none'}`,
          title: section.category?.name ?? t('lists.uncategorized'),
        });
      }
      for (const item of section.items) out.push({ type: 'item', key: item.id, item });
    }
    if (grouped.done.length) {
      out.push({ type: 'done', key: 'done', count: grouped.done.length });
      if (showDone) for (const item of grouped.done) out.push({ type: 'item', key: item.id, item });
    }
    return out;
  }, [items, categories, now, shopping, showDone, t]);

  const onToggle = useCallback(
    (item: ListItemRow) => {
      tapFeedback();
      void actions.setDone(item, !item.is_done);
    },
    [actions],
  );
  const onEdit = useCallback(
    (item: ListItemRow) => router.push({ pathname: '/item/[id]', params: { id: item.id } }),
    [],
  );
  const onDelete = useCallback(
    async (item: ListItemRow) => {
      const ok = await confirm(t('lists.row.delete'), item.title, t('lists.row.delete'), t('common.cancel'));
      if (ok) void actions.deleteItem(item.id);
    },
    [actions, t],
  );

  const onAdd = useAddItem(id, shopping);

  if (!list || list.deleted_at) {
    return (
      <View style={[styles.flex, { backgroundColor: theme.background, padding: Spacing.four }]}>
        <Notice tone="info" message={t('lists.item.notFound')} />
      </View>
    );
  }

  return (
    <View style={[styles.flex, { backgroundColor: theme.card }]}>
      <Stack.Screen
        options={{
          title: list.name,
          headerRight: can(role, 'list.manage')
            ? () => (
                <Button
                  title={t('lists.row.edit')}
                  variant="link"
                  onPress={() => router.push({ pathname: '/list-form', params: { id: list.id } })}
                />
              )
            : undefined,
        }}
      />
      <FlashList
        data={rows}
        keyExtractor={(r) => r.key}
        getItemType={(r) => r.type}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.four }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              engine.sync().finally(() => setRefreshing(false));
            }}
          />
        }
        ListHeaderComponent={
          <>
            <AddItemBar
              listId={id}
              suggest={shopping}
              placeholder={shopping ? t('lists.addPlaceholder') : t('lists.addTodoPlaceholder')}
              onAdd={onAdd}
            />
            {pending > 0 ? (
              <View style={styles.banner}>
                <Notice tone="info" message={t('lists.pending', { count: pending })} />
              </View>
            ) : null}
          </>
        }
        ListEmptyComponent={
          <ThemedText themeColor="textSecondary" style={styles.empty}>
            {t('lists.empty')}
          </ThemedText>
        }
        renderItem={({ item: row }) => {
          if (row.type === 'section') {
            return (
              <ThemedText type="eyebrow" themeColor="textMuted" accessibilityRole="header" style={styles.section}>
                {row.title}
              </ThemedText>
            );
          }
          if (row.type === 'done') {
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: showDone }}
                onPress={() => setShowDone((v) => !v)}
                style={styles.doneHeader}>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {t(shopping ? 'lists.bought' : 'lists.doneSection', { count: row.count })}
                </ThemedText>
                <ThemedText type="small" themeColor="link">
                  {showDone ? t('lists.hideDone') : t('lists.showDone')}
                </ThemedText>
              </Pressable>
            );
          }
          const item = row.item;
          return (
            <ItemRow
              now={now}
              item={item}
              overdue={isOverdue(item, now)}
              assigneeName={item.assignee_id ? names.get(item.assignee_id) : undefined}
              onToggle={onToggle}
              onEdit={onEdit}
              onDelete={canDelete ? onDelete : undefined}
            />
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  banner: { paddingHorizontal: Spacing.four - 4, paddingBottom: Spacing.two },
  empty: { paddingHorizontal: Spacing.four, paddingVertical: Spacing.four, textAlign: 'center' },
  section: {
    paddingHorizontal: Spacing.four - 4,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.one,
  },
  doneHeader: {
    minHeight: 44,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four - 4,
    marginTop: Spacing.three,
  },
});
