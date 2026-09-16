import { can } from '@family-hub/core';
import type { LocationMode } from '@family-hub/data';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Platform } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Chips } from '@/components/ui/chips';
import { Notice } from '@/components/ui/notice';
import { Screen } from '@/components/ui/screen';
import { useFamily } from '@/hooks/queries';
import { useErrorMessage } from '@/hooks/use-error-message';
import { useFamilyLocations } from '@/hooks/use-locations';
import { useNow } from '@/hooks/use-now';
import { endOfDay, formatTime } from '@/lib/format';
import { foregroundGranted, requestBackground, requestForeground, sendCurrentPosition, syncTracking } from '@/lib/location';
import { queryClient, queryKeys } from '@/lib/query-client';
import { repos } from '@/lib/supabase';
import { useUserId } from '@/providers/session-provider';

/** Opt-in sharing with explained permission steps (FR-6.1, FR-6.2) and pause (FR-6.8). */
export default function LocationSettingsScreen() {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const userId = useUserId();
  const { family, role } = useFamily();
  const locations = useFamilyLocations();
  const now = useNow();
  const [notice, setNotice] = useState<'denied' | 'foregroundOnly' | null>(null);

  const mine = locations.data?.settings.find((s) => s.user_id === userId);
  const mode: LocationMode = mine?.mode ?? 'off';
  const pausedUntil = mine?.paused_until && Date.parse(mine.paused_until) > now ? mine.paused_until : null;
  const needsAdult = !can(role, 'location.allowChild') && !mine?.allowed_by;

  const apply = useMutation({
    mutationFn: async ({ next, pause }: { next: LocationMode; pause: string | null }) => {
      const saved = await repos.location.setSharing(next, pause);
      await syncTracking(saved.mode, !!pause);
      if (saved.mode !== 'off' && !pause) await sendCurrentPosition().catch(() => {});
      return saved;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.locations(family.id) }),
  });

  const choose = async (next: LocationMode) => {
    setNotice(null);
    if (next === 'off') return apply.mutate({ next, pause: null });
    if (!(await foregroundGranted()) && !(await requestForeground())) return setNotice('denied');
    if (next === 'always' && !(await requestBackground())) {
      setNotice('foregroundOnly');
      return apply.mutate({ next: 'foreground', pause: null });
    }
    apply.mutate({ next, pause: null });
  };

  if (Platform.OS === 'web') {
    return (
      <Screen modal>
        <Notice tone="info" message={t('location.webUnavailable')} />
      </Screen>
    );
  }

  return (
    <Screen modal>
      <ThemedText>{t('location.explain')}</ThemedText>
      {needsAdult ? <Notice tone="info" message={t('location.needsAdult')} /> : null}
      {!needsAdult ? (
        <>
          <ThemedText themeColor="textSecondary">{t('location.explainAlways')}</ThemedText>
          <Chips
            label={t('location.mode')}
            value={mode}
            onChange={(v) => v && void choose(v)}
            options={(['off', 'foreground', 'always'] as const).map((m) => ({ value: m, label: t(`location.${m}`) }))}
          />
        </>
      ) : null}
      {notice === 'denied' ? (
        <>
          <Notice tone="error" message={t('location.permissionDenied')} />
          <Button title={t('location.openSettings')} variant="secondary" onPress={() => Linking.openSettings()} />
        </>
      ) : null}
      {notice === 'foregroundOnly' ? <Notice tone="info" message={t('location.foregroundOnly')} /> : null}
      {apply.error ? <Notice tone="error" message={errorMessage(apply.error)!} /> : null}

      {mode !== 'off' ? (
        pausedUntil ? (
          <>
            <Notice tone="info" message={t('location.pausedUntil', { time: formatTime(Date.parse(pausedUntil)) })} />
            <Button title={t('location.resume')} onPress={() => apply.mutate({ next: mode, pause: null })} />
          </>
        ) : (
          <Chips
            label={t('location.pause')}
            value={null}
            onChange={(v) => v && apply.mutate({ next: mode, pause: v })}
            options={[
              { value: new Date(now + 3_600_000).toISOString(), label: t('location.pause1h') },
              { value: new Date(Date.parse(endOfDay(0)) + 7 * 3_600_000 + 60_000).toISOString(), label: t('location.pauseTomorrow') },
            ]}
          />
        )
      ) : null}
      {Platform.OS === 'android' && mode === 'always' ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t('location.batteryHint')}
        </ThemedText>
      ) : null}
    </Screen>
  );
}
