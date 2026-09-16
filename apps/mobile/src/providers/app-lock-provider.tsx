import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { appLock } from '@/lib/app-lock';

/** Locks again after this long in the background. */
const GRACE_MS = 60_000;

/** Covers the app until Face ID / fingerprint succeeds, when app lock is on. */
export function AppLockProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [locked, setLocked] = useState(false);
  const backgroundedAt = useRef<number | null>(null);

  const unlock = async () => {
    if (await appLock.authenticate(t('lock.prompt'))) setLocked(false);
  };

  useEffect(() => {
    appLock.enabled().then((on) => {
      if (!on) return;
      setLocked(true);
      void appLock.authenticate(t('lock.prompt')).then((ok) => ok && setLocked(false));
    });
    const sub = AppState.addEventListener('change', async (state) => {
      if (state === 'background') backgroundedAt.current = Date.now();
      if (state === 'active' && backgroundedAt.current && Date.now() - backgroundedAt.current > GRACE_MS) {
        backgroundedAt.current = null;
        if (await appLock.enabled()) setLocked(true);
      }
    });
    return () => sub.remove();
  }, [t]);

  return (
    <View style={styles.flex}>
      {children}
      {locked ? (
        <View style={[StyleSheet.absoluteFill, styles.cover, { backgroundColor: theme.background }]}>
          <ThemedText type="subtitle">{t('lock.title')}</ThemedText>
          <Button title={t('lock.unlock')} onPress={unlock} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  cover: { alignItems: 'center', justifyContent: 'center', gap: Spacing.four, padding: Spacing.four },
});
