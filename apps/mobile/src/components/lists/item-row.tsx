import type { ListItemRow } from '@family-hub/data';
import { memo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import ReanimatedSwipeable, {
  SwipeDirection,
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';

import { ThemedText } from '@/components/themed-text';
import { Icon, Icons } from '@/components/ui/icon';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDay, formatQuantity, isSameLocalDay, shortDue } from '@/lib/format';

interface ItemRowProps {
  item: ListItemRow;
  overdue: boolean;
  /** Current time, for "due today". */
  now: number;
  assigneeName?: string;
  /** Shown under the title, e.g. the list name in "My tasks". */
  context?: string;
  onToggle: (item: ListItemRow) => void;
  onEdit: (item: ListItemRow) => void;
  /** Omitted when the user may not delete (children). */
  onDelete?: (item: ListItemRow) => void;
  /** Horizontal padding; smaller when the row sits inside a card. */
  inset?: number;
  /** Tighter vertical padding for previews in cards. */
  dense?: boolean;
}

/** Tap to complete; swipe right to complete, left for edit and delete (FR-3.3, section 2). */
export const ItemRow = memo(function ItemRow({
  item,
  overdue,
  now,
  assigneeName,
  context,
  onToggle,
  onEdit,
  onDelete,
  inset = Spacing.four - 4,
  dense,
}: ItemRowProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const swipeable = useRef<SwipeableMethods>(null);
  const dueToday = !item.is_done && !overdue && !!item.due_at && isSameLocalDay(item.due_at, now);

  // Right side: when it's due, or how much to buy (as in the design).
  const aside = item.due_at ? shortDue(item.due_at, now) : formatQuantity(item.quantity, item.unit);
  const asideColor = overdue ? theme.danger : dueToday ? theme.warning : theme.textMuted;
  const below = [
    item.due_at ? formatQuantity(item.quantity, item.unit) : '',
    assigneeName ? t('lists.row.assignedTo', { name: assigneeName }) : '',
    context ?? '',
    item.note ?? '',
  ].filter(Boolean);

  const details = [
    formatQuantity(item.quantity, item.unit),
    assigneeName ? t('lists.row.assignedTo', { name: assigneeName }) : '',
    item.due_at ? t(overdue ? 'lists.row.overdue' : 'lists.row.due', { date: formatDay(item.due_at) }) : '',
    context ?? '',
  ].filter(Boolean);

  const actions = [
    { name: 'toggle', label: item.is_done ? t('lists.row.markNotDone') : t('lists.row.markDone') },
    { name: 'edit', label: t('lists.row.edit') },
    ...(onDelete ? [{ name: 'delete', label: t('lists.row.delete') }] : []),
  ];

  return (
    <ReanimatedSwipeable
      ref={swipeable}
      friction={2}
      leftThreshold={64}
      rightThreshold={48}
      overshootLeft={false}
      overshootRight={false}
      renderLeftActions={() => (
        <View style={[styles.action, styles.leftAction, { backgroundColor: theme.success }]}>
          <ThemedText style={styles.actionText}>
            {item.is_done ? t('lists.row.markNotDone') : t('lists.row.markDone')}
          </ThemedText>
        </View>
      )}
      renderRightActions={() => (
        <View style={styles.rightActions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              swipeable.current?.close();
              onEdit(item);
            }}
            style={[styles.action, { backgroundColor: theme.primary }]}>
            <ThemedText style={styles.actionText}>{t('lists.row.edit')}</ThemedText>
          </Pressable>
          {onDelete ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => onDelete(item)}
              style={[styles.action, { backgroundColor: theme.danger }]}>
              <ThemedText style={styles.actionText}>{t('lists.row.delete')}</ThemedText>
            </Pressable>
          ) : null}
        </View>
      )}
      onSwipeableOpen={(direction) => {
        if (direction === SwipeDirection.RIGHT) {
          onToggle(item);
          swipeable.current?.close();
        }
      }}>
      <Pressable
        onPress={() => onToggle(item)}
        onLongPress={() => onEdit(item)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.is_done }}
        accessibilityLabel={[item.title, ...details].join(', ')}
        accessibilityActions={actions}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'toggle') onToggle(item);
          if (e.nativeEvent.actionName === 'edit') onEdit(item);
          if (e.nativeEvent.actionName === 'delete') onDelete?.(item);
        }}
        style={({ pressed }) => [
          styles.row,
          { paddingHorizontal: inset, backgroundColor: pressed ? theme.backgroundElement : theme.card },
          dense && styles.dense,
        ]}>
        <View
          style={[
            styles.check,
            {
              borderColor: item.is_done
                ? theme.success
                : overdue
                  ? theme.danger
                  : dueToday
                    ? theme.warning
                    : theme.textMuted,
            },
            item.is_done && { backgroundColor: theme.success },
          ]}>
          {item.is_done ? <Icon name={Icons.check} size={12} color="#FFFFFF" /> : null}
          {dueToday ? <View style={[styles.dot, { backgroundColor: theme.warning }]} /> : null}
        </View>
        <View style={styles.text}>
          <ThemedText
            style={[styles.title, item.is_done && styles.doneTitle]}
            themeColor={item.is_done ? 'textMuted' : 'text'}>
            {item.title}
          </ThemedText>
          {below.length ? (
            <ThemedText type="caption" themeColor="textMuted" numberOfLines={1}>
              {below.join(' · ')}
            </ThemedText>
          ) : null}
        </View>
        {aside ? (
          <ThemedText type="caption" style={{ color: asideColor }}>
            {aside}
          </ThemedText>
        ) : null}
      </Pressable>
    </ReanimatedSwipeable>
  );
});

const styles = StyleSheet.create({
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - 4,
    paddingVertical: Spacing.three - 4,
  },
  check: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dense: {
    paddingVertical: Spacing.two,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    flex: 1,
    gap: 1,
  },
  title: {
    fontSize: 14,
    lineHeight: 20,
  },
  doneTitle: {
    textDecorationLine: 'line-through',
  },
  rightActions: {
    flexDirection: 'row',
  },
  action: {
    minWidth: 80,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
  },
  leftAction: {
    alignItems: 'flex-start',
  },
  actionText: {
    color: '#ffffff',
    fontWeight: 600,
  },
});
