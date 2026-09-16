import { createActivityRepository } from './activity';
import { createAuthRepository } from './auth';
import type { SupabaseClient } from './client';
import { toAppError } from './errors';
import { createFamilyRepository } from './families';
import { createLocationRepository } from './location';
import { createNotificationRepository } from './notifications';
import { createProfileRepository } from './profiles';
import { createSupabaseRemote } from './sync/remote';

export * from './activity';
export * from './auth';
export * from './calendar';
export * from './client';
export * from './errors';
export * from './families';
export * from './lists';
export * from './location';
export * from './notifications';
export * from './profiles';
export * from './sync';
export type { Database, Json } from './database.types';
export type { Session, User } from '@supabase/supabase-js';

/** Everything screens may use to read and write data. */
export function createRepositories(client: SupabaseClient, authRedirectUrl: string) {
  return {
    auth: createAuthRepository(client, authRedirectUrl),
    profiles: createProfileRepository(client),
    families: createFamilyRepository(client),
    activity: createActivityRepository(client),
    notifications: createNotificationRepository(client),
    location: createLocationRepository(client),
    syncRemote: createSupabaseRemote(client),
    /** FR-3.5: past items matching what the user typed. */
    async suggestItems(familyId: string, prefix: string) {
      const { data, error } = await client.rpc('suggest_items', { p_family_id: familyId, p_prefix: prefix });
      if (error) throw toAppError(error);
      return data;
    },
  };
}

export type Repositories = ReturnType<typeof createRepositories>;
