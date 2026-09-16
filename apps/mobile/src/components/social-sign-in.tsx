import * as AppleAuthentication from 'expo-apple-authentication';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, useColorScheme } from 'react-native';

import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { useErrorMessage } from '@/hooks/use-error-message';
import { appleEnabled, googleEnabled, SignInCancelled, signInWithApple, signInWithGoogle } from '@/lib/social-auth';

/** Apple and Google sign-in buttons (FR-1.1), when configured. */
export function SocialSignIn() {
  const { t } = useTranslation();
  const scheme = useColorScheme();
  const errorMessage = useErrorMessage();
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  if (!appleEnabled && !googleEnabled) return null;

  const run = async (fn: () => Promise<void>) => {
    setError(null);
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      if (!(e instanceof SignInCancelled)) setError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {appleEnabled && Platform.OS === 'ios' ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={
            scheme === 'dark'
              ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
              : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
          }
          cornerRadius={8}
          style={styles.apple}
          onPress={() => run(signInWithApple)}
        />
      ) : appleEnabled ? (
        <Button title={t('auth.continueWithApple')} variant="secondary" onPress={() => run(signInWithApple)} />
      ) : null}
      {googleEnabled ? (
        <Button
          title={t('auth.continueWithGoogle')}
          variant="secondary"
          loading={busy}
          onPress={() => run(signInWithGoogle)}
        />
      ) : null}
      {error ? <Notice tone="error" message={errorMessage(error)!} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  apple: { height: 48, width: '100%' },
});
