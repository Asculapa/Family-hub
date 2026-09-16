import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface SegmentedProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

export function Segmented<T extends string>({ options, value, onChange }: SegmentedProps<T>) {
  const theme = useTheme();

  return (
    <View accessibilityRole="radiogroup" style={[styles.group, { backgroundColor: theme.backgroundSelected }]}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(o.value)}
            style={[
              styles.option,
              selected && [styles.selected, { backgroundColor: theme.card, shadowColor: theme.shadow }],
            ]}>
            <ThemedText type="caption" style={[styles.label, { color: selected ? theme.link : theme.textSecondary }]}>
              {o.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    flexDirection: 'row',
    borderRadius: Radius.control,
    padding: Spacing.one,
  },
  option: {
    flex: 1,
    minHeight: 32,
    paddingHorizontal: Spacing.three - 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.control - 3,
  },
  label: {
    fontWeight: 600,
  },
  selected: {
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
});
