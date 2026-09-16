import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Platform, Switch, View, StyleSheet } from 'react-native';

import { ListRow, SectionTitle } from '@/components/list-row';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useErrorMessage } from '@/hooks/use-error-message';
import { appLock } from '@/lib/app-lock';
import { confirm } from '@/lib/confirm';
import { repos } from '@/lib/supabase';
import { signOut } from '@/lib/sign-out';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const [lockOn, setLockOn] = useState(false);
  const [lockAvailable, setLockAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    appLock.enabled().then(setLockOn);
    appLock.available().then(setLockAvailable);
  }, []);

  const onError = (error: unknown) => Alert.alert(errorMessage(error)!);
  const signOutEverywhere = useMutation({ mutationFn: () => signOut(true), onError });
  const deleteAccount = useMutation({ mutationFn: () => repos.auth.deleteAccount(), onError });

  return (
    <Screen modal>
      <SectionTitle>{t('settings.profile')}</SectionTitle>
      <ListRow title={t('family.editProfile')} onPress={() => router.push('/profile')} />
      <ListRow title={t('settings.notifications')} onPress={() => router.push('/settings-notifications')} />
      <ListRow title={t('settings.location')} onPress={() => router.push('/settings-location')} />

      {Platform.OS !== 'web' ? (
        <>
          <SectionTitle>{t('settings.security')}</SectionTitle>
          <View style={styles.switchRow}>
            <View style={styles.flex}>
              <ThemedText>{t('settings.appLock')}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {lockAvailable ? t('settings.appLockHint') : t('settings.appLockUnavailable')}
              </ThemedText>
            </View>
            <Switch
              accessibilityLabel={t('settings.appLock')}
              value={lockOn}
              disabled={!lockAvailable}
              onValueChange={async (on) => {
                // Confirm it works before relying on it.
                if (on && !(await appLock.authenticate(t('lock.prompt')))) return;
                await appLock.setEnabled(on);
                setLockOn(on);
              }}
            />
          </View>
        </>
      ) : null}

      <SectionTitle>{t('settings.account')}</SectionTitle>
      <Button title={t('auth.signOut')} variant="secondary" onPress={() => signOut()} />
      <Button
        title={t('auth.signOutEverywhere')}
        variant="secondary"
        loading={signOutEverywhere.isPending}
        onPress={async () => {
          const ok = await confirm(
            t('auth.signOutEverywhere'),
            t('auth.signOutEverywhereConfirm'),
            t('auth.signOut'),
            t('common.cancel'),
          );
          if (ok) signOutEverywhere.mutate();
        }}
      />
      <Button
        title={t('settings.deleteAccount')}
        variant="danger"
        loading={deleteAccount.isPending}
        onPress={async () => {
          const ok = await confirm(
            t('settings.deleteAccount'),
            t('settings.deleteAccountConfirm'),
            t('settings.deleteAccountFinal'),
            t('common.cancel'),
          );
          if (ok) deleteAccount.mutate();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, minHeight: 56 },
});
