import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card, IconTile, TileTones } from '@/components/ui/card';
import { Icon, Icons } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { LATER_FEATURES } from '@/constants/later-features';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Preview of a feature that isn't built yet. */
export default function LaterFeatureScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { feature } = useLocalSearchParams<{ feature: string }>();
  const f = LATER_FEATURES.find((x) => x.key === feature) ?? LATER_FEATURES[0];
  const key = `later.features.${f.key}`;

  return (
    <Screen modal eyebrow={t('later.eyebrow')} title={t(`${key}.title`)}>
      <Card style={styles.card}>
        <IconTile name={f.icon} {...TileTones[f.tone]} size={48} />
        <ThemedText type="small" themeColor="textSecondary">
          {t(`${key}.description`)}
        </ThemedText>
        <View style={styles.items}>
          {(['item1', 'item2', 'item3'] as const).map((item) => (
            <View key={item} style={[styles.item, { backgroundColor: theme.backgroundElement }]}>
              <View style={[styles.check, { backgroundColor: theme.primarySoft }]}>
                <Icon name={Icons.check} size={12} color={theme.link} />
              </View>
              <ThemedText type="small">{t(`${key}.${item}`)}</ThemedText>
            </View>
          ))}
        </View>
        <View style={[styles.planned, { backgroundColor: theme.primary }]}>
          <ThemedText type="caption" style={[styles.plannedText, { color: theme.onPrimary }]}>
            {t('later.planned')}
          </ThemedText>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.four - 4, gap: Spacing.three },
  items: { gap: Spacing.two + 2 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - 4,
    paddingHorizontal: Spacing.three - 4,
    paddingVertical: Spacing.three - 4,
    borderRadius: Radius.control,
  },
  check: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  planned: { paddingVertical: Spacing.three - 4, borderRadius: Radius.control, alignItems: 'center' },
  plannedText: { fontWeight: 600 },
});
