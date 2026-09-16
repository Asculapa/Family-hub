import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { secureStorage } from '@/lib/secure-storage';

export const SETUP_DONE_KEY = 'setup-done';

/** Opens the notifications/location setup once after joining a family (FR-9.4). */
export function SetupPrompt() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    secureStorage.getItem(SETUP_DONE_KEY).then((done) => {
      if (!done) router.push('/setup');
    });
  }, []);
  return null;
}
