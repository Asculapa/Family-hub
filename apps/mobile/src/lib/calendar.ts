import type { Occurrence } from '@family-hub/core';
import { getCalendars } from 'expo-localization';

export const DAY_MS = 86_400_000;

/** The device time zone; new timed events repeat in it. */
export function deviceTimeZone(): string {
  return getCalendars()[0]?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
}

/**
 * Calendar day of an instant as UTC midnight ms. All-day events are stored as
 * UTC dates; timed events use the viewer's local date (FR-5.6).
 */
export function dayOf(ms: number, allDay: boolean): number {
  if (allDay) return Math.floor(ms / DAY_MS) * DAY_MS;
  const d = new Date(ms);
  return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
}

export const occurrenceDay = (o: Pick<Occurrence, 'start' | 'allDay'>) => dayOf(o.start, o.allDay);

/** Local midnight of the viewer's today as UTC-midnight day ms. */
export const today = () => dayOf(Date.now(), false);

/** "YYYY-MM-DD" for a UTC-midnight day, as react-native-calendars expects. */
export const dayString = (dayMs: number) => new Date(dayMs).toISOString().slice(0, 10);

/** Local start instant of a UTC-midnight day (for querying timed events). */
export function localStartOf(dayMs: number): number {
  const d = new Date(dayMs);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()).getTime();
}
