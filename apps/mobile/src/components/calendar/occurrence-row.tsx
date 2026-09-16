import type { Birthday, Occurrence } from '@family-hub/core';
import type { EventRow } from '@family-hub/data';
import { i18next } from '@family-hub/i18n';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Icon, Icons } from '@/components/ui/icon';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { today } from '@/lib/calendar';
import { formatDayHeading, formatTime } from '@/lib/format';

interface OccurrenceRowProps {
  occurrence: Occurrence<EventRow>;
  /** UTC-midnight day the row is listed under. */
  day: number;
  color: string | null;
  names: string[];
  onPress: (o: Occurrence<EventRow>) => void;
}

export function OccurrenceRow({ occurrence: o, day, color, names, onPress }: OccurrenceRowProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const when = o.allDay ? t('calendar.allDay') : `${formatTime(o.start)} – ${formatTime(o.end)}`;
  const details = [when, o.locationText, names.join(', '), o.recurring ? t('calendar.repeats') : null].filter(Boolean);

  return (
    <Card
      onPress={() => onPress(o)}
      accessibilityLabel={[formatDayHeading(day), o.title, ...details].join(', ')}
      style={styles.row}>
      <DateBadge day={day} />
      <View style={[styles.bar, { backgroundColor: color ?? theme.textMuted }]} />
      <View style={styles.text}>
        <ThemedText style={styles.title} numberOfLines={1}>
          {o.title}
        </ThemedText>
        <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
          {details.join(' · ')}
        </ThemedText>
      </View>
      <Icon name={Icons.chevronRight} size={16} color={theme.textMuted} />
    </Card>
  );
}

export function BirthdayRow({ birthday, day, color }: { birthday: Birthday; day: number; color: string | null }) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <Card style={styles.row}>
      <DateBadge day={day} />
      <View style={[styles.bar, { backgroundColor: color ?? theme.textMuted }]} />
      <View style={styles.text}>
        <ThemedText style={styles.title} numberOfLines={1}>
          🎂 {t('calendar.birthday', { name: birthday.name, age: birthday.age })}
        </ThemedText>
        <ThemedText type="caption" themeColor="textSecondary">
          {t('calendar.allDay')}
        </ThemedText>
      </View>
    </Card>
  );
}

/** "TODAY 26" / "SAT 27" column. */
function DateBadge({ day }: { day: number }) {
  const { t } = useTranslation();
  const date = new Date(day);
  const label =
    day === today()
      ? t('calendar.today')
      : date.toLocaleDateString(i18next.language, { weekday: 'short', timeZone: 'UTC' });
  return (
    <View style={styles.date} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <ThemedText themeColor="textMuted" style={styles.weekday} numberOfLines={1}>
        {label}
      </ThemedText>
      <ThemedText style={styles.dayNumber}>{date.getUTCDate()}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - 4,
    padding: 14,
  },
  date: {
    width: 40,
    alignItems: 'center',
  },
  weekday: {
    fontSize: 9,
    lineHeight: 12,
    fontWeight: 700,
    textTransform: 'uppercase',
  },
  dayNumber: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: 600,
  },
  bar: { width: 4, height: 40, borderRadius: 2 },
  text: { flex: 1, gap: 2 },
  title: { fontSize: 14, lineHeight: 20, fontWeight: 600 },
});
