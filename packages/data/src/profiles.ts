import type { SupabaseClient } from './client';
import type { Database } from './database.types';
import { unwrap } from './errors';

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type ProfileUpdate = Pick<
  Database['public']['Tables']['profiles']['Update'],
  'display_name' | 'color' | 'locale' | 'timezone' | 'birthday'
>;

export function createProfileRepository(client: SupabaseClient) {
  return {
    async get(userId: string): Promise<Profile | null> {
      return unwrap(await client.from('profiles').select('*').eq('id', userId).maybeSingle());
    },

    async update(userId: string, changes: ProfileUpdate): Promise<Profile> {
      return unwrap(
        await client.from('profiles').update(changes).eq('id', userId).select('*').single(),
      );
    },
  };
}

export type ProfileRepository = ReturnType<typeof createProfileRepository>;
