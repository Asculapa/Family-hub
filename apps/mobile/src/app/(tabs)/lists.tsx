import { can, isOverdue, normalizeTitle } from '@family-hub/core';
import type { ListItemRow } from '@family-hub/data';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, StyleSheet, TextInput, View } from 'react-native';

import { ShoppingCard, TodoCard } from '@/components/lists/list-cards';
import { ThemedText } from '@/components/themed-text';
import { Chips } from '@/components/ui/chips';
import { Icon, Icons } from '@/components/ui/icon';
import { Notice } from '@/components/ui/notice';
import { Screen } from '@/components/ui/screen';
import { Radius, Spacing } from '@/constants/theme';
import { useFamily } from '@/hooks/queries';
import { useAllItems, useLists, usePendingCount } from '@/hooks/use-lists';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { useSync } from '@/providers/sync-provider';

type Filter = 'all' | 'shopping' | 'todo';

export default function ListsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { role } = useFamily();
  const { engine } = useSync();
  const lists = useLists();
  const items = useAllItems();
  const pending = usePendingCount();
  const now = useNow();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const byList = useMemo(() => {
    const map = new Map<string, ListItemRow[]>();
    for (const i of items) {
      if (i.deleted_at) continue;
      map.set(i.list_id, [...(map.get(i.list_id) ?? []), i]);
    }
    return map;
  }, [items]);

  // A list matches the search by its name or any of its open items.
  const q = normalizeTitle(query);
  const shown = lists.filter(
    (l) =>
      (filter === 'all' || l.type === filter) &&
      (!q ||
        normalizeTitle(l.name).includes(q) ||
        (byList.get(l.id) ?? []).some((i) => !i.is_done && normalizeTitle(i.title).includes(q))),
  );

  return (
    <Screen
      eyebrow={t('lists.eyebrow')}
      title={t('lists.heading')}
      tabs
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            engine.sync().finally(() => setRefreshing(false));
          }}
        />
      }>
      <View style={[styles.search, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        <Icon name={Icons.search} size={16} color={theme.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('lists.search')}
          accessibilityLabel={t('lists.search')}
          placeholderTextColor={theme.textMuted}
          returnKeyType="search"
          style={[styles.searchInput, { color: theme.text }]}
        />
        {can(role, 'list.manage') ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('lists.newList')}
            onPress={() => router.push('/list-form')}
            hitSlop={8}
            style={({ pressed }) => [styles.add, { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 }]}>
            <Icon name={Icons.add} size={16} color={theme.onPrimary} />
          </Pressable>
        ) : null}
      </View>
      <Chips
        label={t('lists.title')}
        hideLabel
        compact
        value={filter}
        onChange={setFilter}
        options={(['all', 'shopping', 'todo'] as const).map((f) => ({ value: f, label: t(`lists.filters.${f}`) }))}
      />

      {pending > 0 ? <Notice tone="info" message={t('lists.pending', { count: pending })} /> : null}

      {shown.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary">
          {q ? t('lists.noMatches', { query }) : t('lists.noneOfType')}
        </ThemedText>
      ) : null}
      {shown.map((list) =>
        list.type === 'shopping' ? (
          <ShoppingCard key={list.id} list={list} items={byList.get(list.id) ?? []} now={now} />
        ) : (
          <TodoCard
            key={list.id}
            list={list}
            items={byList.get(list.id) ?? []}
            now={now}
            overdue={(item) => isOverdue(item, now)}
          />
        ),
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three - 4,
    paddingVertical: 6,
    borderRadius: Radius.control,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchInput: { flex: 1, minHeight: 32, fontSize: 14, paddingVertical: 0 },
  add: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});
