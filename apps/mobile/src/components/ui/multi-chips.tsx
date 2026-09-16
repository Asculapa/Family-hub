import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface MultiChipsProps<T extends string> {
  label: string;
  options: { value: T; label: string; color?: string | null }[];
  value: T[];
  onChange: (value: T[]) => void;
}

/** Several choices from a wrapping row of toggle chips. */
export function MultiChips<T extends string>({ label, options, value, onChange }: MultiChipsProps<T>) {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <ThemedText type="smallBold">{label}</ThemedText>
      <View accessibilityLabel={label} style={styles.row}>
        {options.map((o) => {
          const selected = value.includes(o.value);
          return (
            <Pressable
              key={o.value}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: selected }}
              onPress={() => onChange(selected ? value.filter((v) => v !== o.value) : [...value, o.value])}
              style={[
                styles.chip,
                {
                  backgroundColor: selected ? (o.color ?? theme.primary) : theme.backgroundElement,
                },
              ]}>
              <ThemedText type="small" style={{ color: selected ? theme.onPrimary : theme.text }}>
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
  chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.three, borderRadius: 22 },
});
