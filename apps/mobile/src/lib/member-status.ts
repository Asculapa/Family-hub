import type { FamilyLocations } from '@family-hub/data';
import { i18next } from '@family-hub/i18n';

import { formatTime, timeAgo } from './format';

/** Map/Home status line for a member (FR-6.5, FR-6.8). */
export function memberLocationStatus(data: FamilyLocations | undefined, userId: string, now: number): string {
  const t = i18next.t.bind(i18next);
  const settings = data?.settings.find((s) => s.user_id === userId);
  const latest = data?.latest.find((l) => l.user_id === userId);
  const checkIn = data?.checkIns.find((c) => c.user_id === userId);

  if (settings && settings.mode !== 'off' && settings.paused_until && Date.parse(settings.paused_until) > now) {
    return t('map.pausedUntil', { time: formatTime(Date.parse(settings.paused_until)) });
  }
  if (latest) {
    const parts = [t('map.updated', { ago: timeAgo(latest.recorded_at, now) })];
    if (latest.battery_pct !== null) parts.push(t('map.battery', { pct: latest.battery_pct }));
    return parts.join(' · ');
  }
  if (checkIn) {
    const ago = timeAgo(checkIn.created_at, now);
    return checkIn.note ? t('map.checkedInNote', { ago, note: checkIn.note }) : t('map.checkedIn', { ago });
  }
  return t('map.notSharing');
}
