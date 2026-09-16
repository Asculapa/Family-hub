import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** "2 sharing now" badge in the corner of a map. */
export function SharingPill({ count }: { count: number }) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <View style={[styles.pill, { backgroundColor: theme.card, shadowColor: theme.shadow }]} pointerEvents="none">
      <View style={[styles.dot, { backgroundColor: count ? theme.success : theme.textMuted }]} />
      <ThemedText themeColor="textSecondary" style={styles.text}>
        {t('home.sharingNow', { count })}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    position: 'absolute',
    top: Spacing.three,
    right: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.one,
    borderRadius: Radius.pill,
    opacity: 0.94,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  text: { fontSize: 10, lineHeight: 14, fontWeight: 500 },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
