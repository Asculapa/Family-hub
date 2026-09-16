import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { FamilyMap } from '@/components/family-map';
import { SharingPill } from '@/components/sharing-pill';
import { ThemedText } from '@/components/themed-text';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icons } from '@/components/ui/icon';
import { Notice } from '@/components/ui/notice';
import { Screen } from '@/components/ui/screen';
import { Radius, Spacing } from '@/constants/theme';
import { useFamily, useMembers } from '@/hooks/queries';
import { useErrorMessage } from '@/hooks/use-error-message';
import { useFamilyLocations, useTrail } from '@/hooks/use-locations';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { sendCurrentPosition } from '@/lib/location';
import { memberLocationStatus } from '@/lib/member-status';
import { repos } from '@/lib/supabase';
import { useUserId } from '@/providers/session-provider';

/** Family map (FR-6.5), check-in (FR-6.6) and "Where are you?" (FR-6.7). */
export default function MapScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const userId = useUserId();
  const errorMessage = useErrorMessage();
  const { family } = useFamily();
  const members = useMembers(family.id);
  const locations = useFamilyLocations();
  const now = useNow();
  const [selected, setSelected] = useState<string | null>(null);
  const trail = useTrail(selected);

  const ask = useMutation({
    mutationFn: (to: string) => repos.location.requestLocation(to),
    onSuccess: (_, to) => {
      const name = members.data?.find((m) => m.userId === to)?.displayName ?? '';
      Alert.alert(t('map.asked', { name }));
    },
    onError: (e) => Alert.alert(errorMessage(e)!),
  });

  const mine = locations.data?.settings.find((s) => s.user_id === userId);
  const sharing = !!mine && mine.mode !== 'off';
  const statusOf = (id: string) => memberLocationStatus(locations.data, id, now);

  const centerOnMe = async () => {
    if (!locations.data?.latest.some((l) => l.user_id === userId)) {
      await sendCurrentPosition().catch(() => {});
      await locations.refetch();
    }
    setSelected(userId);
  };

  return (
    <Screen
      eyebrow={t('map.eyebrow')}
      title={t('map.heading')}
      tabs
      refreshControl={
        <RefreshControl
          refreshing={locations.isRefetching}
          onRefresh={async () => {
            if (sharing) await sendCurrentPosition().catch(() => {});
            await locations.refetch();
          }}
        />
      }>
      <View style={[styles.map, { borderColor: theme.cardBorder }]}>
        <FamilyMap
          members={members.data ?? []}
          latest={locations.data?.latest ?? []}
          trail={trail.data ?? []}
          selected={selected}
          statusOf={statusOf}
          onSelect={setSelected}
          height={288}
        />
        <SharingPill count={locations.data?.latest.length ?? 0} />
      </View>
      {locations.isError ? <Notice tone="error" message={t('common.loadFailed')} /> : null}
      <View style={styles.actions}>
        <Button
          title={t('location.checkIn')}
          icon={Icons.location}
          onPress={() => router.push('/check-in')}
          style={styles.flex}
        />
        <Button title={t('map.centerOnMe')} variant="secondary" onPress={centerOnMe} style={styles.secondary} />
      </View>

      <View style={styles.members}>
        {(members.data ?? []).map((m) => {
          const isMe = m.userId === userId;
          const hasPosition = !!locations.data?.latest.some((l) => l.user_id === m.userId);
          return (
            <Card
              key={m.userId}
              onPress={hasPosition ? () => setSelected(selected === m.userId ? null : m.userId) : undefined}
              accessibilityLabel={`${m.displayName}, ${statusOf(m.userId)}`}
              accessibilityHint={
                hasPosition ? (selected === m.userId ? t('map.hideTrail') : t('map.showTrail')) : undefined
              }
              style={styles.member}>
              <Avatar name={m.displayName} color={m.color} />
              <View style={styles.flex}>
                <ThemedText style={styles.name}>
                  {isMe ? `${m.displayName} (${t('family.you')})` : m.displayName}
                </ThemedText>
                <ThemedText type="caption" themeColor="textSecondary">
                  {statusOf(m.userId)}
                </ThemedText>
                {isMe ? null : (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => ask.mutate(m.userId)}
                    disabled={ask.isPending && ask.variables === m.userId}
                    hitSlop={8}>
                    <ThemedText type="caption" themeColor="link" style={styles.ask}>
                      {t('map.whereAreYou')}
                    </ThemedText>
                  </Pressable>
                )}
              </View>
              <View style={[styles.dot, { backgroundColor: hasPosition ? theme.success : theme.textMuted }]} />
            </Card>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  map: { borderRadius: Radius.card, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  actions: { flexDirection: 'row', gap: Spacing.two },
  secondary: { paddingHorizontal: Spacing.three },
  members: { gap: Spacing.two + 2 },
  member: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three - 4, padding: Spacing.three },
  name: { fontSize: 14, lineHeight: 20, fontWeight: 600 },
  ask: { fontWeight: 600, marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
