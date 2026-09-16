import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Inline message box for errors and confirmations. */
export function Notice({ tone, message }: { tone: 'error' | 'info' | 'success'; message: string }) {
  const theme = useTheme();
  const colors = {
    error: { background: theme.dangerSoft, text: theme.danger },
    success: { background: theme.successSoft, text: theme.success },
    info: { background: theme.primarySoft, text: theme.link },
  }[tone];

  return (
    <View style={[styles.box, { backgroundColor: colors.background }]} accessibilityLiveRegion="polite">
      <ThemedText type="smallBold" style={{ color: colors.text }}>
        {message}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    borderRadius: Radius.control,
  },
});
