import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator } from 'react-native';

import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { Screen } from '@/components/ui/screen';
import { repos } from '@/lib/supabase';

/**
 * Target of every auth email link (magic link, email confirmation, password
 * reset): exchanges the PKCE code for a session.
 */
export default function AuthCallbackScreen() {
  const { t } = useTranslation();
  const { code, next } = useLocalSearchParams<{ code?: string; next?: string }>();
  const [failed, setFailed] = useState(!code);

  useEffect(() => {
    if (!code) return;
    repos.auth
      .exchangeCode(code)
      .then(() => router.replace(next === 'reset-password' ? '/reset-password' : '/'))
      .catch(() => setFailed(true));
  }, [code, next]);

  return (
    <Screen title={failed ? undefined : t('auth.callback.working')}>
      {failed ? (
        <>
          <Notice tone="error" message={t('auth.callback.failed')} />
          <Button title={t('auth.callback.back')} onPress={() => router.replace('/sign-in')} />
        </>
      ) : (
        <ActivityIndicator />
      )}
    </Screen>
  );
}
