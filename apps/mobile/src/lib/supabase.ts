import { createRepositories, createSupabaseClient } from '@family-hub/data';
import * as Linking from 'expo-linking';
import { AppState, Platform } from 'react-native';

import { secureStorage } from './secure-storage';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. Copy apps/mobile/.env.example to .env.local.',
  );
}

export const supabase = createSupabaseClient({ url, anonKey, storage: secureStorage });

/** Where auth emails (magic link, confirmation, password reset) return to. */
export const authRedirectUrl = Linking.createURL('auth/callback');

export const repos = createRepositories(supabase, authRedirectUrl);

// Refresh the session only while the app is in the foreground.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
