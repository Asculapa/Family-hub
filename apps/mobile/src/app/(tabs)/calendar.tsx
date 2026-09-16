import type { Occurrence } from '@family-hub/core';
import type { EventRow } from '@family-hub/data';
import { i18next } from '@family-hub/i18n';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { Calendar } from 'react-native-calendars';

import { DayBlock, type Day } from '@/components/calendar/day-list';
import { ThemedText } from '@/components/themed-text';
import { Section } from '@/components/list-row';
import { Card } from '@/components/ui/card';
import { Chips } from '@/components/ui/chips';
import { Icon, Icons, type IconName } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { Radius, Spacing } from '@/constants/theme';
import { useFamily, useMembers } from '@/hooks/queries';
import { useBirthdays, useMemberColors, useOccurrences } from '@/hooks/use-calendar';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { DAY_MS, dayString, dayOf, localStartOf, occurrenceDay } from '@/lib/calendar';
import { formatDay, formatDayHeading } from '@/lib/format';

type View_ = 'agenda' | 'week' | 'month';
const AGENDA_DAYS = 90;

export default function CalendarScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { family } = useFamily();
  const members = useMembers(family.id);
  const colors = useMemberColors();
  const now = useNow();
  const today = dayOf(now, false);

  const [view, setView] = useState<View_>('agenda');
  const [memberId, setMemberId] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState(() => today - ((new Date(today).getUTCDay() + 6) % 7) * DAY_MS);
  const [selected, setSelected] = useState(today);
  const [month, setMonth] = useState(() => today);

  // Range covered by the current view, as UTC-midnight days.
  const [fromDay, toDay] = useMemo((): [number, number] => {
    if (view === 'week') return [weekStart, weekStart + 7 * DAY_MS];
    if (view === 'month') {
      const m = new Date(month);
      return [
        Date.UTC(m.getUTCFullYear(), m.getUTCMonth(), 1) - 7 * DAY_MS,
        Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 1) + 7 * DAY_MS,
      ];
    }
    return [today, today + AGENDA_DAYS * DAY_MS];
  }, [view, weekStart, month, today]);

  // Timed events use local time and all-day events UTC dates; query a day wider and bucket by day.
  const occurrences = useOccurrences(localStartOf(fromDay) - DAY_MS, localStartOf(toDay) + DAY_MS, memberId);
  const bdays = useBirthdays(fromDay, toDay, memberId);

  const days = useMemo(() => {
    const map = new Map<number, Day>();
    const bucket = (day: number) => {
      if (day < fromDay || day >= toDay) return null;
      let d = map.get(day);
      if (!d) map.set(day, (d = { day, occurrences: [], birthdays: [] }));
      return d;
    };
    for (const o of occurrences) {
      // Events in progress today show under today.
      const d = bucket(Math.max(occurrenceDay(o), view === 'agenda' ? today : fromDay));
      d?.occurrences.push(o);
    }
    for (const b of bdays) bucket(b.start)?.birthdays.push(b);
    return [...map.values()].sort((a, b) => a.day - b.day);
  }, [occurrences, bdays, fromDay, toDay, today, view]);

  const open = (o: Occurrence<EventRow>) =>
    router.push({ pathname: '/event-form', params: { id: o.event.id, start: o.originalStart } });

  const newEvent = () =>
    router.push({ pathname: '/event-form', params: { day: String(view === 'agenda' ? today : selected) } });

  const marked = useMemo(() => {
    const m: Record<string, { marked?: boolean; dotColor?: string; selected?: boolean; selectedColor?: string }> = {};
    for (const d of days) {
      const first = d.occurrences[0]?.participantIds[0];
      m[dayString(d.day)] = { marked: true, dotColor: (first && colors.get(first)) || theme.primary };
    }
    m[dayString(selected)] = { ...m[dayString(selected)], selected: true, selectedColor: theme.primary };
    return m;
  }, [days, selected, colors, theme.primary]);

  // Agenda: the first three entries go in the "Next up" card, the rest below.
  const [nextUp, later] = useMemo(() => {
    const first: Day[] = [];
    const rest: Day[] = [];
    let n = 0;
    for (const d of days) {
      const entries = d.birthdays.length + d.occurrences.length;
      if (n >= 3) rest.push(d);
      else if (n + entries <= 3) first.push(d);
      else {
        const take = 3 - n;
        const birthdays = d.birthdays.slice(0, take);
        const occurrences = d.occurrences.slice(0, take - birthdays.length);
        first.push({ ...d, birthdays, occurrences });
        rest.push({
          ...d,
          birthdays: d.birthdays.slice(birthdays.length),
          occurrences: d.occurrences.slice(occurrences.length),
        });
      }
      n += entries;
    }
    return [first, rest];
  }, [days]);

  const goToday = () => {
    setWeekStart(today - ((new Date(today).getUTCDay() + 6) % 7) * DAY_MS);
    setMonth(today);
    setSelected(today);
  };
  const addEvent = { label: t('calendar.addEvent'), onPress: newEvent };
  const thisWeek = weekStart <= today && today < weekStart + 7 * DAY_MS;
  const selectedDay = days.find((d) => d.day === selected);

  return (
    <Screen
      eyebrow={t('calendar.eyebrow')}
      title={monthTitle(view === 'week' ? weekStart : view === 'month' ? month : today)}
      tabs>
      <Segmented
        options={(['agenda', 'week', 'month'] as const).map((v) => ({ value: v, label: t(`calendar.views.${v}`) }))}
        value={view}
        onChange={setView}
      />
      <Chips
        label={t('calendar.filter')}
        hideLabel
        compact
        value={memberId}
        onChange={setMemberId}
        options={[
          { value: null, label: t('calendar.everyone') },
          ...(members.data ?? []).map((m) => ({ value: m.userId, label: m.displayName })),
        ]}
      />

      {view === 'agenda' ? (
        <>
          <Card style={styles.card}>
            <View style={styles.cardHeader}>
              <ThemedText style={styles.cardTitle}>{t('calendar.nextUp')}</ThemedText>
            </View>
            {nextUp.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                {t('calendar.empty')}
              </ThemedText>
            ) : null}
            {nextUp.map((d) => (
              <DayBlock key={d.day} day={d} onPress={open} />
            ))}
          </Card>
          <Section title={t('calendar.upcoming')} action={addEvent}>
            {later.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                {t('calendar.nothingElse')}
              </ThemedText>
            ) : null}
            {later.map((d) => (
              <DayBlock key={d.day} day={d} onPress={open} />
            ))}
          </Section>
        </>
      ) : null}

      {view === 'week' ? (
        <Section
          title={
            thisWeek
              ? t('calendar.thisWeek')
              : t('calendar.weekOf', { date: formatDay(new Date(weekStart).toISOString()) })
          }
          action={addEvent}>
          <Card style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.nav}>
                <IconButton
                  icon={Icons.chevronLeft}
                  label={t('calendar.previousWeek')}
                  onPress={() => setWeekStart((w) => w - 7 * DAY_MS)}
                />
                <IconButton
                  icon={Icons.chevronRight}
                  label={t('calendar.nextWeek')}
                  onPress={() => setWeekStart((w) => w + 7 * DAY_MS)}
                />
              </View>
              <TodayLink onPress={goToday} />
            </View>
            {days.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                {t('calendar.empty')}
              </ThemedText>
            ) : null}
            {days.map((d) => (
              <DayBlock key={d.day} day={d} onPress={open} />
            ))}
          </Card>
        </Section>
      ) : null}

      {view === 'month' ? (
        <>
          <Card style={styles.month}>
            <Calendar
              key={`${theme.background}-${dayString(month)}`}
              current={dayString(month)}
              firstDay={1}
              markedDates={marked}
              onDayPress={(d) => setSelected(Date.parse(d.dateString))}
              onMonthChange={(m) => setMonth(Date.parse(m.dateString))}
              theme={{
                calendarBackground: theme.card,
                dayTextColor: theme.text,
                monthTextColor: theme.text,
                textSectionTitleColor: theme.textMuted,
                textDisabledColor: theme.textMuted,
                todayTextColor: theme.link,
                todayBackgroundColor: theme.primarySoft,
                selectedDayBackgroundColor: theme.primary,
                selectedDayTextColor: theme.onPrimary,
                arrowColor: theme.textMuted,
                textMonthFontSize: 14,
                textMonthFontWeight: '600',
                textDayFontSize: 12,
                textDayHeaderFontSize: 10,
                textDayHeaderFontWeight: '600',
              }}
            />
          </Card>
          <Section title={formatDayHeading(selected)} action={addEvent}>
            {selectedDay ? (
              <DayBlock day={selectedDay} onPress={open} />
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                {t('calendar.emptyDay')}
              </ThemedText>
            )}
          </Section>
        </>
      ) : null}
    </Screen>
  );
}

function TodayLink({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={12}>
      <ThemedText type="caption" themeColor="link" style={styles.today}>
        {t('calendar.today')}
      </ThemedText>
    </Pressable>
  );
}

function IconButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.iconButton, pressed && { backgroundColor: theme.backgroundElement }]}>
      <Icon name={icon} size={16} color={theme.textMuted} />
    </Pressable>
  );
}

/** "September 2026" for the page title. */
function monthTitle(dayMs: number): string {
  return new Date(dayMs).toLocaleDateString(i18next.language, { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

const styles = StyleSheet.create({
  card: { padding: Spacing.three, gap: Spacing.three - 4 },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.one,
  },
  cardTitle: { fontSize: 14, lineHeight: 20, fontWeight: 600 },
  today: { fontWeight: 600 },
  nav: { flexDirection: 'row', gap: Spacing.one },
  iconButton: { padding: Spacing.two, borderRadius: Radius.control - 4 },
  month: { overflow: 'hidden', paddingBottom: Spacing.two },
});
