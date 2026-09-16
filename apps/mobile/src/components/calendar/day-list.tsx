import type { Birthday, Occurrence } from '@family-hub/core';
import type { EventRow } from '@family-hub/data';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useMemberColors } from '@/hooks/use-calendar';
import { useMemberNames } from '@/hooks/use-member-names';

import { BirthdayRow, OccurrenceRow } from './occurrence-row';

export interface Day {
  day: number;
  occurrences: Occurrence<EventRow>[];
  birthdays: Birthday[];
}

/** One day's entries; each row carries its own date. */
export function DayBlock({ day, onPress }: { day: Day; onPress: (o: Occurrence<EventRow>) => void }) {
  const colors = useMemberColors();
  const names = useMemberNames();
  return (
    <View style={styles.day}>
      {day.birthdays.map((b) => (
        <BirthdayRow key={b.key} birthday={b} day={day.day} color={colors.get(b.userId) ?? null} />
      ))}
      {day.occurrences.map((o) => (
        <OccurrenceRow
          key={o.key}
          occurrence={o}
          day={day.day}
          color={(o.participantIds[0] && colors.get(o.participantIds[0])) || null}
          names={o.participantIds.map((id) => names.get(id) ?? '').filter(Boolean)}
          onPress={onPress}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  day: { gap: Spacing.two + 2 },
});
