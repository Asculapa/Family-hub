import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { Screen } from '@/components/ui/screen';
import { Colors } from '@/constants/theme';
import { useMembership } from '@/hooks/queries';
import { i18nReady } from '@/lib/i18n';
import { queryClient } from '@/lib/query-client';
import '@/lib/location'; // defines background tasks before the OS delivers events
import { LocationProvider } from '@/providers/location-provider';
import { NotificationsProvider } from '@/providers/notifications-provider';
import { SessionProvider, useSession } from '@/providers/session-provider';
import { AppLockProvider } from '@/providers/app-lock-provider';
import { SyncProvider } from '@/providers/sync-provider';
import { ProfileDefaults } from '@/components/profile-defaults';
import { SetupPrompt } from '@/components/setup-prompt';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [i18nLoaded, setI18nLoaded] = useState(false);

  useEffect(() => {
    i18nReady.finally(() => setI18nLoaded(true));
  }, []);

  if (!i18nLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <ThemeProvider value={navigationTheme(colorScheme === 'dark' ? 'dark' : 'light')}>
            <RootNavigator />
          </ThemeProvider>
        </SessionProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

/** Navigation headers and backgrounds in the app palette. */
function navigationTheme(scheme: 'light' | 'dark') {
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const c = Colors[scheme];
  return {
    ...base,
    colors: { ...base.colors, primary: c.link, background: c.background, card: c.background, text: c.text, border: c.cardBorder },
  };
}

function RootNavigator() {
  const { t } = useTranslation();
  const { session, loading } = useSession();
  const membership = useMembership();

  const signedIn = !!session;
  const resolving = loading || (signedIn && membership.isPending);
  const hasFamily = !!membership.data;

  useEffect(() => {
    if (!resolving) SplashScreen.hideAsync();
  }, [resolving]);

  if (resolving) return null;

  if (signedIn && membership.isError) {
    return (
      <Screen title={t('tabs.home')}>
        <Notice tone="error" message={t('common.loadFailed')} />
        <Button title={t('common.retry')} onPress={() => membership.refetch()} />
      </Screen>
    );
  }

  const stack = (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>

      <Stack.Protected guard={signedIn && !hasFamily}>
        <Stack.Screen name="(onboarding)" />
      </Stack.Protected>

      <Stack.Protected guard={signedIn && hasFamily}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="invite"
          options={{ presentation: 'modal', headerShown: true, title: t('invite.create.title') }}
        />
        <Stack.Screen
          name="profile"
          options={{ presentation: 'modal', headerShown: true, title: t('profile.title') }}
        />
        <Stack.Screen name="member/[id]" options={{ presentation: 'modal', headerShown: true, title: '' }} />
        <Stack.Screen name="lists/[id]" options={{ headerShown: true, title: '', headerBackTitle: t('tabs.lists') }} />
        <Stack.Screen name="my-tasks" options={{ headerShown: true, title: t('lists.myTasks') }} />
        <Stack.Screen
          name="item/[id]"
          options={{ presentation: 'modal', headerShown: true, title: t('lists.item.title') }}
        />
        <Stack.Screen name="settings" options={{ presentation: 'modal', headerShown: true, title: t('settings.title') }} />
        <Stack.Screen name="activity" options={{ headerShown: true, title: t('activity.title') }} />
        <Stack.Screen name="later/[feature]" options={{ presentation: 'modal', headerShown: true, title: '' }} />
        <Stack.Screen
          name="settings-notifications"
          options={{ presentation: 'modal', headerShown: true, title: t('notifications.title') }}
        />
        <Stack.Screen
          name="settings-location"
          options={{ presentation: 'modal', headerShown: true, title: t('location.settingsTitle') }}
        />
        <Stack.Screen name="check-in" options={{ presentation: 'modal', headerShown: true, title: t('location.checkIn') }} />
        <Stack.Screen name="setup" options={{ presentation: 'modal', headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="event-form" options={{ presentation: 'modal', headerShown: true, title: '' }} />
        <Stack.Screen
          name="list-form"
          options={{ presentation: 'modal', headerShown: true, title: t('lists.form.newTitle') }}
        />
      </Stack.Protected>

      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="reset-password" />
      </Stack.Protected>

      {/* Deep link targets, reachable in any state. */}
      <Stack.Screen name="auth/callback" />
      <Stack.Screen name="join/[token]" />
    </Stack>
  );

  // Lists and other family data sync while the user has a family.
  if (session && membership.data) {
    return (
      <AppLockProvider>
        <SyncProvider familyId={membership.data.family.id} userId={session.user.id}>
          <NotificationsProvider>
            <LocationProvider>
              <ProfileDefaults userId={session.user.id} />
              <SetupPrompt />
              {stack}
            </LocationProvider>
          </NotificationsProvider>
        </SyncProvider>
      </AppLockProvider>
    );
  }
  return stack;
}
