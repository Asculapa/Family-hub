import type { SupabaseClient } from './client';
import type { Database } from './database.types';
import { check, unwrap } from './errors';

export type NotificationPrefs = Database['public']['Tables']['notification_prefs']['Row'];
export type NotificationPrefsUpdate = Omit<
  Database['public']['Tables']['notification_prefs']['Insert'],
  'user_id' | 'updated_at'
>;

export const DEFAULT_PREFS: NotificationPrefsUpdate = {
  item_assigned: true,
  event_reminder: true,
  location_request: true,
  member_joined: true,
  list_changed: true,
  quiet_start: '22:00:00',
  quiet_end: '07:00:00',
};

export function createNotificationRepository(client: SupabaseClient) {
  return {
    async registerDevice(token: string, platform: 'ios' | 'android' | 'web', deviceName: string | null) {
      check(await client.rpc('register_push_token', { p_token: token, p_platform: platform, p_device_name: deviceName ?? undefined }));
    },

    /** This device stops getting pushes, e.g. on sign-out. */
    async unregisterDevice(token: string) {
      check(await client.from('push_tokens').delete().eq('token', token));
    },

    /** No device gets pushes any more ("sign out on all devices"). */
    async forgetDevices() {
      check(await client.rpc('forget_devices'));
    },

    async getPrefs(userId: string): Promise<NotificationPrefsUpdate> {
      const row = unwrap(await client.from('notification_prefs').select('*').eq('user_id', userId).maybeSingle());
      return { ...DEFAULT_PREFS, ...(row ?? {}) };
    },

    async savePrefs(userId: string, prefs: NotificationPrefsUpdate) {
      check(await client.from('notification_prefs').upsert({ user_id: userId, ...prefs }));
    },
  };
}
