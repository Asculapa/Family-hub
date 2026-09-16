import { isOverdue } from '@family-hub/core';
import type { ListItemRow } from '@family-hub/data';
import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { DayBlock } from '@/components/calendar/day-list';
import { FamilyMap } from '@/components/family-map';
import { ItemRow } from '@/components/lists/item-row';
import { ShoppingCard } from '@/components/lists/list-cards';
import { Section } from '@/components/list-row';
import { ThemedText } from '@/components/themed-text';
import { Avatar } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Icon, Icons } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { SharingPill } from '@/components/sharing-pill';
import { Radius, Spacing } from '@/constants/theme';
import { useFamily, useMembers } from '@/hooks/queries';
import { useBirthdays, useOccurrences } from '@/hooks/use-calendar';
import { useAllItems, useLists } from '@/hooks/use-lists';
import { useFamilyLocations } from '@/hooks/use-locations';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { DAY_MS, dayOf, localStartOf, occurrenceDay } from '@/lib/calendar';
import { formatDayHeading } from '@/lib/format';
import { tapFeedback } from '@/lib/haptics';
import { memberLocationStatus } from '@/lib/member-status';
import { useUserId } from '@/providers/session-provider';
import { useSync } from '@/providers/sync-provider';

/** Today dashboard (FR-9.1). */
export default function HomeScreen() {
  const { t } = useTranslation();
  const userId = useUserId();
  const { family } = useFamily();
  const members = useMembers(family.id);
  const locations = useFamilyLocations();
  const { engine, actions } = useSync();
  const now = useNow();
  const today = dayOf(now, false);
  const [refreshing, setRefreshing] = useState(false);

  // Next three events in the coming month, birthdays included.
  const occurrences = useOccurrences(now, localStartOf(today + 31 * DAY_MS), null);
  const bdays = useBirthdays(today, today + 31 * DAY_MS, null);
  const upNext = useMemo(() => {
    const entries = [
      ...occurrences.map((o) => ({ day: occurrenceDay(o), start: o.start, o })),
      ...bdays.map((b) => ({ day: b.start, start: b.start, b })),
    ]
      .sort((a, b) => a.day - b.day || a.start - b.start)
      .slice(0, 3);
    const days = new Map<number, { day: number; occurrences: typeof occurrences; birthdays: typeof bdays }>();
    for (const e of entries) {
      const d = days.get(e.day) ?? { day: e.day, occurrences: [], birthdays: [] };
      if ('o' in e && e.o) d.occurrences.push(e.o);
      if ('b' in e && e.b) d.birthdays.push(e.b);
      days.set(e.day, d);
    }
    return [...days.values()];
  }, [occurrences, bdays]);
  const eventsToday =
    occurrences.filter((o) => occurrenceDay(o) <= today).length + bdays.filter((b) => b.start === today).length;

  const items = useAllItems();
  const lists = useLists();
  const endOfToday = localStartOf(today + DAY_MS);
  const myTasks = useMemo(
    () =>
      items
        .filter(
          (i) =>
            i.assignee_id === userId && !i.is_done && !i.deleted_at && i.due_at && Date.parse(i.due_at) < endOfToday,
        )
        .sort((a, b) => a.due_at!.localeCompare(b.due_at!)),
    [items, userId, endOfToday],
  );
  const shopping = useMemo(
    () =>
      lists
        .filter((l) => l.type === 'shopping')
        .map((l) => ({ list: l, items: items.filter((i) => i.list_id === l.id && !i.deleted_at) })),
    [lists, items],
  );
  const shoppingCount = shopping.reduce((n, s) => n + s.items.filter((i) => !i.is_done).length, 0);

  const theme = useTheme();
  const memberList = members.data ?? [];
  const byId = new Map(memberList.map((m) => [m.userId, m]));
  const me = byId.get(userId);
  const sharingCount = locations.data?.latest.length ?? 0;

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

  const hour = new Date(now).getHours();
  const greetingKey =
    hour < 12 ? 'home.greetingMorning' : hour < 18 ? 'home.greetingAfternoon' : 'home.greetingEvening';

  return (
    <Screen
      subtitle={formatDayHeading(today)}
      title={t(greetingKey, { name: me?.displayName.split(' ')[0] ?? '' })}
      largeTitle
      tabs
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            Promise.all([engine.sync(), members.refetch(), locations.refetch()]).finally(() => setRefreshing(false));
          }}
        />
      }>
      <Hero
        headline={myTasks.length ? t('home.tasksDue', { count: myTasks.length }) : t('home.caughtUp')}
        summary={[
          t('home.eventsToday', { count: eventsToday }),
          t('home.tasksCount', { count: myTasks.length }),
          t('lists.openCount', { count: shoppingCount }),
        ].join(' · ')}
        footer={sharingCount ? t('home.sharing', { count: sharingCount }) : t('home.nobodySharing')}
        members={memberList}
      />

      <Section
        title={t('home.comingUp')}
        action={{ label: t('home.seeCalendar'), onPress: () => router.push('/calendar') }}>
        {upNext.length === 0 ? <Empty text={t('home.noEvents')} /> : null}
        {upNext.map((d) => (
          <DayBlock
            key={d.day}
            day={d}
            onPress={(o) =>
              router.push({ pathname: '/event-form', params: { id: o.event.id, start: o.originalStart } })
            }
          />
        ))}
      </Section>

      <Section
        title={t('lists.myTasks')}
        action={{ label: t('home.viewTasks'), onPress: () => router.push('/my-tasks') }}>
        {myTasks.length === 0 ? (
          <Empty text={t('home.noTasks')} />
        ) : (
          <Card style={styles.tasks}>
            {myTasks.map((item) => (
              <ItemRow
                now={now}
                key={item.id}
                item={item}
                overdue={isOverdue(item, now)}
                onToggle={onToggle}
                onEdit={onEdit}
                inset={Spacing.three - 4}
              />
            ))}
          </Card>
        )}
      </Section>

      {shopping.map(({ list, items: listItems }, index) => (
        <Section
          key={list.id}
          title={index === 0 ? t('home.shoppingList') : list.name}
          action={{
            label: t('home.openList'),
            onPress: () => router.push({ pathname: '/lists/[id]', params: { id: list.id } }),
          }}>
          <ShoppingCard list={list} items={listItems} now={now} />
        </Section>
      ))}

      <Section title={t('home.location')} action={{ label: t('home.openMap'), onPress: () => router.push('/map') }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t('home.openMap')}. ${memberList
            .map((m) => `${m.displayName}: ${memberLocationStatus(locations.data, m.userId, now)}`)
            .join('. ')}`}
          onPress={() => router.push('/map')}
          style={[styles.map, { borderColor: theme.cardBorder }]}>
          <FamilyMap
            members={memberList}
            latest={locations.data?.latest ?? []}
            trail={[]}
            selected={null}
            statusOf={(id) => memberLocationStatus(locations.data, id, now)}
            onSelect={() => router.push('/map')}
            height={144}
            interactive={false}
          />
          <SharingPill count={sharingCount} />
        </Pressable>
      </Section>
    </Screen>
  );
}

/** Indigo summary card at the top of Home. */
function Hero({
  headline,
  summary,
  footer,
  members,
}: {
  headline: string;
  summary: string;
  footer: string;
  members: { userId: string; displayName: string; color: string | null }[];
}) {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <View style={[styles.hero, { backgroundColor: theme.primary, shadowColor: theme.primary }]}>
      <View style={styles.heroTop}>
        <View style={styles.heroText}>
          <ThemedText type="caption" style={styles.heroEyebrow}>
            {t('home.eyebrow').toUpperCase()}
          </ThemedText>
          <ThemedText style={styles.heroHeadline}>{headline}</ThemedText>
          <ThemedText type="small" style={styles.heroSummary}>
            {summary}
          </ThemedText>
        </View>
        <View style={styles.stack}>
          {members.slice(0, 4).map((m, i) => (
            <View key={m.userId} style={i > 0 && styles.stacked}>
              <Avatar name={m.displayName} color={m.color} size={28} ring="#FFFFFF" inverse />
            </View>
          ))}
        </View>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/map')}
        style={({ pressed }) => [styles.heroFooter, pressed && { opacity: 0.7 }]}>
        <Icon name={Icons.location} size={14} color={HERO_SOFT} />
        <ThemedText type="caption" style={styles.heroFooterText}>
          {footer}
        </ThemedText>
        <Icon name={Icons.chevronRight} size={16} color={HERO_SOFT} />
      </Pressable>
    </View>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <Card style={styles.empty}>
      <ThemedText type="small" themeColor="textSecondary">
        {text}
      </ThemedText>
    </Card>
  );
}

const HERO_SOFT = 'rgba(255, 255, 255, 0.7)';
const HERO_TEXT = 'rgba(255, 255, 255, 0.85)';

const styles = StyleSheet.create({
  hero: {
    borderRadius: Radius.hero,
    padding: Spacing.four - 4,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 6,
  },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
  heroText: { flex: 1 },
  heroEyebrow: { color: HERO_SOFT, marginBottom: Spacing.one },
  heroHeadline: { color: '#FFFFFF', fontSize: 18, lineHeight: 28, fontWeight: 600 },
  heroSummary: { color: HERO_TEXT, marginTop: Spacing.one },
  stack: { flexDirection: 'row' },
  stacked: { marginLeft: -8 },
  heroFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.four - 4,
    paddingTop: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
  },
  heroFooterText: { flex: 1, color: HERO_TEXT },
  tasks: { padding: 6, overflow: 'hidden' },
  map: { borderRadius: Radius.card, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  empty: { padding: Spacing.three },
});
