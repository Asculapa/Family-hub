import type { SupabaseClient } from './client';
import type { Database } from './database.types';
import { unwrap } from './errors';

export type ActivityRow = Database['public']['Tables']['activity_log']['Row'];

export interface ActivitySummary {
  title?: string;
  list_id?: string;
  list_name?: string;
  list_type?: 'shopping' | 'todo';
  starts_at?: string;
  note?: string | null;
}

export function createActivityRepository(client: SupabaseClient) {
  return {
    /** The family's last 30 days of activity, newest first (FR-8.1). */
    async list(familyId: string, limit = 100): Promise<ActivityRow[]> {
      return unwrap(
        await client
          .from('activity_log')
          .select('*')
          .eq('family_id', familyId)
          .order('created_at', { ascending: false })
          .limit(limit),
      );
    },
  };
}
