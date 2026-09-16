import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Spacing } from '@/constants/theme';
import { formatDateTime, formatTime } from '@/lib/format';

export interface DateTimeFieldProps {
  label: string;
  /** Local date-time; for mode "date" only the local calendar date matters. */
  value: Date;
  onChange: (value: Date) => void;
  mode: 'date' | 'time' | 'datetime';
  error?: string | null;
}

/** Native date/time pickers: inline on iOS, dialogs on Android. */
export function DateTimeField({ label, value, onChange, mode, error }: DateTimeFieldProps) {
  if (Platform.OS === 'ios') {
    return (
      <View style={styles.row}>
        <ThemedText type="smallBold" style={styles.label}>
          {label}
        </ThemedText>
        <DateTimePicker
          value={value}
          mode={mode}
          display="compact"
          minuteInterval={5}
          accessibilityLabel={label}
          onChange={(_, date) => date && onChange(date)}
        />
      </View>
    );
  }

  const open = () =>
    DateTimePickerAndroid.open({
      value,
      mode: mode === 'time' ? 'time' : 'date',
      is24Hour: true,
      onChange: (event, date) => {
        if (event.type !== 'set' || !date) return;
        if (mode !== 'datetime') return onChange(date);
        DateTimePickerAndroid.open({
          value: date,
          mode: 'time',
          is24Hour: true,
          onChange: (e, time) => e.type === 'set' && time && onChange(time),
        });
      },
    });

  return (
    <View style={styles.container}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <Button
        title={mode === 'time' ? formatTime(value.getTime()) : formatDateTime(value, mode === 'date')}
        variant="secondary"
        accessibilityLabel={label}
        onPress={open}
      />
      {error ? (
        <ThemedText type="small" themeColor="danger">
          {error}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.one },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 },
  label: { flex: 1 },
});
