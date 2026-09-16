import { DEFAULT_PREFS, type NotificationPrefsUpdate } from '@family-hub/data';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Platform, StyleSheet, Switch, View } from 'react-native';

import { SectionTitle } from '@/components/list-row';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { DateTimeField } from '@/components/ui/date-time-field';
import { Notice } from '@/components/ui/notice';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useErrorMessage } from '@/hooks/use-error-message';
import { permissionState, registerDevice, requestPermission, type PermissionState } from '@/lib/notifications';
import { repos } from '@/lib/supabase';
import { useUserId } from '@/providers/session-provider';

const TYPES = ['item_assigned', 'event_reminder', 'location_request', 'member_joined', 'list_changed'] as const;

/** Per-type switches and quiet hours (FR-7.3). */
export default function NotificationSettingsScreen() {
  const { t } = useTranslation();
  const userId = useUserId();
  const errorMessage = useErrorMessage();
  const [permission, setPermission] = useState<PermissionState>('undetermined');
  const prefs = useQuery({ queryKey: ['notification-prefs', userId], queryFn: () => repos.notifications.getPrefs(userId) });

  useEffect(() => {
    permissionState().then(setPermission);
  }, []);

  const turnOn = async () => {
    if (permission === 'denied') return Linking.openSettings();
    if (await requestPermission()) {
      setPermission('granted');
      await registerDevice();
    } else {
      setPermission('denied');
    }
  };

  return (
    <Screen modal>
      {Platform.OS === 'web' ? (
        <Notice tone="info" message={t('notifications.webUnavailable')} />
      ) : permission === 'granted' ? (
        <Notice tone="success" message={t('notifications.permissionOn')} />
      ) : (
        <>
          <Notice tone="info" message={t('notifications.permissionOff')} />
          <Button
            title={permission === 'denied' ? t('notifications.openSettings') : t('notifications.turnOn')}
            onPress={turnOn}
          />
        </>
      )}
      {prefs.isError ? <Notice tone="error" message={t('common.loadFailed')} /> : null}
      {prefs.data ? <PrefsForm initial={prefs.data} userId={userId} errorMessage={errorMessage} /> : null}
    </Screen>
  );
}

function PrefsForm({
  initial,
  userId,
  errorMessage,
}: {
  initial: NotificationPrefsUpdate;
  userId: string;
  errorMessage: (e: unknown) => string | null;
}) {
  const { t } = useTranslation();
  const [prefs, setPrefs] = useState({ ...DEFAULT_PREFS, ...initial });
  const save = useMutation({ mutationFn: (next: NotificationPrefsUpdate) => repos.notifications.savePrefs(userId, next) });

  const update = (changes: Partial<NotificationPrefsUpdate>) => {
    const next = { ...prefs, ...changes };
    setPrefs(next);
    save.mutate(next);
  };
  const toDate = (time: string) => {
    const [h, m] = time.split(':').map(Number);
    return new Date(2000, 0, 1, h, m);
  };
  const toTime = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:00`;

  return (
    <>
      <SectionTitle>{t('notifications.types')}</SectionTitle>
      {TYPES.map((type) => (
        <View key={type} style={styles.row}>
          <View style={styles.flex}>
            <ThemedText>{t(`notifications.${type}`)}</ThemedText>
            {type === 'list_changed' ? (
              <ThemedText type="small" themeColor="textSecondary">
                {t('notifications.list_changedHint')}
              </ThemedText>
            ) : null}
          </View>
          <Switch
            accessibilityLabel={t(`notifications.${type}`)}
            value={prefs[type] ?? true}
            onValueChange={(on) => update({ [type]: on })}
          />
        </View>
      ))}
      <SectionTitle>{t('notifications.quietHours')}</SectionTitle>
      <ThemedText type="small" themeColor="textSecondary">
        {t('notifications.quietHoursHint')}
      </ThemedText>
      <DateTimeField
        label={t('notifications.quietStart')}
        mode="time"
        value={toDate(prefs.quiet_start ?? '22:00')}
        onChange={(d) => update({ quiet_start: toTime(d) })}
      />
      <DateTimeField
        label={t('notifications.quietEnd')}
        mode="time"
        value={toDate(prefs.quiet_end ?? '07:00')}
        onChange={(d) => update({ quiet_end: toTime(d) })}
      />
      {save.error ? <Notice tone="error" message={errorMessage(save.error)!} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, minHeight: 56 },
});
