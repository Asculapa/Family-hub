import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface ChipsProps<T> {
  /** Shown above the chips; also the group's accessibility label. */
  label: string;
  hideLabel?: boolean;
  /** Small pills, as used for filters. */
  compact?: boolean;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

/** Single choice from a wrapping row of chips. */
export function Chips<T extends string | null>({ label, hideLabel, compact, options, value, onChange }: ChipsProps<T>) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      {hideLabel ? null : <ThemedText type="smallBold">{label}</ThemedText>}
      <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.row}>
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <Pressable
              key={String(o.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              onPress={() => onChange(o.value)}
              hitSlop={compact ? 8 : undefined}
              style={[
                styles.chip,
                compact && styles.compact,
                selected
                  ? { backgroundColor: theme.primary, borderColor: theme.primary }
                  : { backgroundColor: theme.card, borderColor: theme.cardBorder },
              ]}>
              <ThemedText
                type={compact ? 'caption' : 'smallBold'}
                style={[compact && styles.compactText, { color: selected ? theme.onPrimary : theme.textSecondary }]}>
                {o.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.one },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  compact: { minHeight: 30, paddingHorizontal: Spacing.three - 4 },
  compactText: { fontWeight: 600 },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
