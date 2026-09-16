import { useEffect } from 'react';

import { useProfile } from '@/hooks/queries';
import { deviceTimeZone } from '@/lib/calendar';
import { queryClient, queryKeys } from '@/lib/query-client';
import { repos } from '@/lib/supabase';

/**
 * Keeps the profile's time zone in step with the device (FR-1.5, FR-5.6), so
 * server-side reminders and quiet hours use the right local time.
 */
export function ProfileDefaults({ userId }: { userId: string }) {
  const profile = useProfile();
  const current = profile.data?.timezone;

  useEffect(() => {
    const tz = deviceTimeZone();
    if (!current || current === tz) return;
    repos.profiles
      .update(userId, { timezone: tz })
      .then((p) => queryClient.setQueryData(queryKeys.profile(userId), p))
      .catch(() => {});
  }, [current, userId]);

  return null;
}
