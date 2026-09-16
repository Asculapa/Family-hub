import type { ListItemRow, ListRow as List } from '@family-hub/data';
import { router } from 'expo-router';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { AddItemBar } from '@/components/lists/add-item-bar';
import { ItemRow } from '@/components/lists/item-row';
import { ThemedText } from '@/components/themed-text';
import { Card, IconTile, TileTones } from '@/components/ui/card';
import { Icon, Icons } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useAddItem } from '@/hooks/use-add-item';
import { useTheme } from '@/hooks/use-theme';
import { timeAgo } from '@/lib/format';
import { tapFeedback } from '@/lib/haptics';
import { useSync } from '@/providers/sync-provider';

const DAY_MS = 86_400_000;

function useItemActions() {
  const { actions } = useSync();
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
  return { onToggle, onEdit };
}

const openList = (list: List) => router.push({ pathname: '/lists/[id]', params: { id: list.id } });

/** Shopping list with quick add, its open items and today's bought ones. */
export function ShoppingCard({
  list,
  items,
  now,
  limit = 4,
}: {
  list: List;
  items: ListItemRow[];
  now: number;
  limit?: number;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { onToggle, onEdit } = useItemActions();
  const onAdd = useAddItem(list.id, true);

  const open = items.filter((i) => !i.is_done);
  const bought = items
    .filter((i) => i.is_done && i.done_at && now - Date.parse(i.done_at) < DAY_MS)
    .sort((a, b) => b.done_at!.localeCompare(a.done_at!));
  const shown = [...open, ...bought].slice(0, limit);
  const hidden = open.length + bought.length - shown.length;

  return (
    <Card style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${list.name}, ${t('home.itemsLeft', { count: open.length })}`}
        onPress={() => openList(list)}
        style={({ pressed }) => [styles.header, pressed && styles.pressed]}>
        <IconTile name={Icons.shopping} {...TileTones.emerald} />
        <View style={styles.flex}>
          <ThemedText style={styles.title}>{list.name}</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            {t('home.itemsLeft', { count: open.length })}
          </ThemedText>
        </View>
        <View style={[styles.badge, { backgroundColor: open.length ? theme.successSoft : theme.backgroundElement }]}>
          <ThemedText style={[styles.badgeText, { color: open.length ? theme.success : theme.textMuted }]}>
            {open.length ? t('home.active') : t('home.allDone')}
          </ThemedText>
        </View>
      </Pressable>
      <AddItemBar listId={list.id} suggest placeholder={t('lists.addPlaceholder')} onAdd={onAdd} compact />
      {shown.length ? (
        <View style={styles.items}>
          {shown.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              now={now}
              overdue={false}
              onToggle={onToggle}
              onEdit={onEdit}
              inset={4}
              dense
            />
          ))}
        </View>
      ) : null}
      {hidden > 0 ? (
        <Pressable accessibilityRole="button" onPress={() => openList(list)} hitSlop={8}>
          <ThemedText type="caption" themeColor="link" style={styles.more}>
            {t('home.moreItems', { count: hidden })}
          </ThemedText>
        </Pressable>
      ) : null}
    </Card>
  );
}

/** To-do list header with its next open tasks. */
export function TodoCard({
  list,
  items,
  now,
  overdue,
  limit = 2,
}: {
  list: List;
  items: ListItemRow[];
  now: number;
  overdue: (item: ListItemRow) => boolean;
  limit?: number;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { onToggle, onEdit } = useItemActions();
  const open = items.filter((i) => !i.is_done).sort((a, b) => (a.due_at ?? '￿').localeCompare(b.due_at ?? '￿'));
  const subtitle = [
    t('home.tasksCount', { count: open.length }),
    t('lists.updated', { ago: timeAgo(list.updated_at, now) }),
  ].join(' · ');

  return (
    <Card style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${list.name}, ${subtitle}`}
        onPress={() => openList(list)}
        style={({ pressed }) => [styles.header, pressed && styles.pressed]}>
        <IconTile name={Icons.checklist} {...TileTones.violet} />
        <View style={styles.flex}>
          <ThemedText style={styles.title}>{list.name}</ThemedText>
          <ThemedText type="caption" themeColor="textSecondary">
            {subtitle}
          </ThemedText>
        </View>
        <Icon name={Icons.chevronRight} size={16} color={theme.textMuted} />
      </Pressable>
      {open.length ? (
        <View style={[styles.tasks, { borderTopColor: theme.cardBorder }]}>
          {open.slice(0, limit).map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              now={now}
              overdue={overdue(item)}
              onToggle={onToggle}
              onEdit={onEdit}
              inset={4}
            />
          ))}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { padding: Spacing.three, gap: Spacing.three - 4, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three - 4 },
  pressed: { opacity: 0.7 },
  title: { fontSize: 14, lineHeight: 20, fontWeight: 600 },
  badge: { paddingHorizontal: Spacing.two, paddingVertical: Spacing.one, borderRadius: Radius.pill },
  badgeText: { fontSize: 10, lineHeight: 12, fontWeight: 600, textTransform: 'uppercase' },
  items: { gap: Spacing.one },
  tasks: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.two, gap: Spacing.one },
  more: { fontWeight: 600 },
});
