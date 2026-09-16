import { createClient, type SupportedStorage } from '@supabase/supabase-js';

import type { Database } from './database.types';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  /** Session storage: expo-secure-store on native, browser storage on web. */
  storage?: SupportedStorage;
}

export function createSupabaseClient({ url, anonKey, storage }: SupabaseConfig) {
  return createClient<Database>(url, anonKey, {
    auth: {
      storage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  });
}

export type SupabaseClient = ReturnType<typeof createSupabaseClient>;
