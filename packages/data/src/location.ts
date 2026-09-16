import type { SupabaseClient } from './client';
import type { Database } from './database.types';
import { check, unwrap } from './errors';

type Tables = Database['public']['Tables'];
export type LocationMode = Database['public']['Enums']['location_mode'];
export type LocationSettings = Tables['location_settings']['Row'];
export type LocationLatest = Tables['location_latest']['Row'];
export type LocationPoint = Tables['location_points']['Row'];
export type CheckIn = Tables['check_ins']['Row'];

export interface PositionFix {
  lat: number;
  lng: number;
  accuracy: number | null;
  recorded_at: string;
}

export interface FamilyLocations {
  settings: LocationSettings[];
  latest: LocationLatest[];
  /** Newest check-in per member from the last 7 days. */
  checkIns: CheckIn[];
}

export function createLocationRepository(client: SupabaseClient) {
  return {
    async familyLocations(familyId: string): Promise<FamilyLocations> {
      const [settings, latest, checkIns] = await Promise.all([
        client.from('location_settings').select('*').eq('family_id', familyId),
        client.from('location_latest').select('*').eq('family_id', familyId),
        client.from('check_ins').select('*').eq('family_id', familyId).order('created_at', { ascending: false }).limit(200),
      ]);
      const newest = new Map<string, CheckIn>();
      for (const c of unwrap(checkIns)) if (!newest.has(c.user_id)) newest.set(c.user_id, c);
      return { settings: unwrap(settings), latest: unwrap(latest), checkIns: [...newest.values()] };
    },

    /** Today's trail of a member (FR-6.5). */
    async trail(userId: string): Promise<LocationPoint[]> {
      return unwrap(
        await client.from('location_points').select('*').eq('user_id', userId).order('recorded_at').limit(2000),
      );
    },

    async setSharing(mode: LocationMode, pausedUntil: string | null = null): Promise<LocationSettings> {
      return unwrap(await client.rpc('set_location_sharing', { p_mode: mode, p_paused_until: pausedUntil ?? undefined }));
    },

    async allowChild(childId: string, allowed: boolean) {
      check(await client.rpc('allow_child_location', { p_child: childId, p_allowed: allowed }));
    },

    /** Uploads a batch; returns how many points were stored (0 when not sharing). */
    async ingest(points: PositionFix[], batteryPct: number | null): Promise<number> {
      return unwrap(
        await client.rpc('ingest_locations', { p_points: points as never, p_battery: batteryPct ?? undefined }),
      );
    },

    async checkIn(position: Omit<PositionFix, 'recorded_at'> | null, note: string | null): Promise<CheckIn> {
      return unwrap(
        await client.rpc('check_in', {
          p_lat: position?.lat,
          p_lng: position?.lng,
          p_accuracy: position?.accuracy ?? undefined,
          p_note: note ?? undefined,
        }),
      );
    },

    async requestLocation(userId: string) {
      check(await client.rpc('request_location', { p_to: userId }));
    },
  };
}

export type LocationRepository = ReturnType<typeof createLocationRepository>;
