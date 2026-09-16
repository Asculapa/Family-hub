import { i18next } from '@family-hub/i18n';

/** "Mon, 28 Sep" in the user's language. */
export function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString(i18next.language, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

/** End of the local day, `days` from today; due dates without a time use it. */
export function endOfDay(days: number, from = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  d.setHours(23, 59, 0, 0);
  return d.toISOString();
}

export function formatQuantity(quantity: number | null, unit: string | null): string {
  if (quantity === null) return unit ?? '';
  return unit ? `${quantity} ${unit}` : String(quantity);
}

export function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(i18next.language, { hour: '2-digit', minute: '2-digit' });
}

export function formatDateTime(d: Date, dateOnly = false): string {
  const day = d.toLocaleDateString(i18next.language, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  return dateOnly ? day : `${day}, ${formatTime(d.getTime())}`;
}

/** Heading for a day in the calendar, e.g. "Monday, 28 September". */
export function formatDayHeading(dayMs: number): string {
  return new Date(dayMs).toLocaleDateString(i18next.language, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}

/** "just now", "5 min ago", "3 h ago", or the date for older times. */
export function timeAgo(iso: string, now: number): string {
  const minutes = Math.floor((now - Date.parse(iso)) / 60_000);
  if (minutes < 1) return i18next.t('activity.justNow');
  if (minutes < 60) return i18next.t('activity.minutesAgo', { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return i18next.t('activity.hoursAgo', { count: hours });
  return formatDay(iso);
}

/** Short due label for list rows: "Today", "Tomorrow", "Sat", or "28 Sep". */
export function shortDue(iso: string, now: number): string {
  const due = new Date(iso);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const days = Math.floor((due.getTime() - start.getTime()) / 86_400_000);
  if (days === 0) return i18next.t('lists.item.dueToday');
  if (days === 1) return i18next.t('lists.item.dueTomorrow');
  if (days > 1 && days < 7) return due.toLocaleDateString(i18next.language, { weekday: 'short' });
  return due.toLocaleDateString(i18next.language, { day: 'numeric', month: 'short' });
}

/** True when the ISO time falls on the local day containing `now`. */
export function isSameLocalDay(iso: string, now: number): boolean {
  return new Date(iso).toDateString() === new Date(now).toDateString();
}
