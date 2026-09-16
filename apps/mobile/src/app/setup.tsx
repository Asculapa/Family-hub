import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { SETUP_DONE_KEY } from '@/components/setup-prompt';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { closeScreen } from '@/lib/navigation';
import { registerDevice, requestPermission } from '@/lib/notifications';
import { secureStorage } from '@/lib/secure-storage';

/** Onboarding steps 2 and 3 (FR-9.4): notifications (FR-7.1), then location. Both skippable. */
export default function SetupScreen() {
  const { t } = useTranslation();
  const [step, setStep] = useState<'notifications' | 'location'>('notifications');

  const finish = async (next?: '/settings-location') => {
    await secureStorage.setItem(SETUP_DONE_KEY, '1');
    closeScreen();
    if (next) router.push(next);
  };

  if (step === 'notifications') {
    return (
      <Screen title={t('setup.notificationsTitle')} subtitle={t('setup.step', { n: 1 })}>
        <ThemedText>{t('setup.notificationsBody')}</ThemedText>
        <Button
          title={t('setup.notificationsYes')}
          onPress={async () => {
            if (await requestPermission()) await registerDevice().catch(() => {});
            setStep('location');
          }}
        />
        <Button title={t('setup.notNow')} variant="link" onPress={() => setStep('location')} />
      </Screen>
    );
  }
  return (
    <Screen title={t('setup.locationTitle')} subtitle={t('setup.step', { n: 2 })}>
      <ThemedText>{t('setup.locationBody')}</ThemedText>
      <Button title={t('setup.locationYes')} onPress={() => finish('/settings-location')} />
      <Button title={t('setup.notNow')} variant="link" onPress={() => finish()} />
      <ThemedText type="small" themeColor="textSecondary">
        {t('setup.later')}
      </ThemedText>
    </Screen>
  );
}
