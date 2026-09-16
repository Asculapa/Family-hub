import { dayNumber, fromDayNumber, fromWall, toWall, weekday } from './time';

/**
 * Recurring events (FR-5.3). Same rules as event_occurrences() in the
 * database: FREQ=DAILY|WEEKLY|MONTHLY|YEARLY, BYDAY for weekly, repeating at
 * the event's wall-clock time in its own time zone.
 */
export const FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export const WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export interface Rule {
  freq: Frequency;
  /** Weekly only; defaults to the weekday of the first occurrence. */
  byday?: Weekday[];
}

export function parseRule(rrule: string | null): Rule | null {
  if (!rrule) return null;
  const freq = /FREQ=([A-Z]+)/.exec(rrule)?.[1] as Frequency | undefined;
  if (!freq || !FREQUENCIES.includes(freq)) return null;
  const byday = /BYDAY=([A-Z,]+)/.exec(rrule)?.[1]?.split(',') as Weekday[] | undefined;
  return byday ? { freq, byday } : { freq };
}

export function buildRule(rule: Rule | null): string | null {
  if (!rule) return null;
  const byday = rule.freq === 'WEEKLY' && rule.byday?.length ? `;BYDAY=${sortWeekdays(rule.byday).join(',')}` : '';
  return `FREQ=${rule.freq}${byday}`;
}

const sortWeekdays = (days: Weekday[]) =>
  [...new Set(days)].sort((a, b) => ((WEEKDAYS.indexOf(a) + 6) % 7) - ((WEEKDAYS.indexOf(b) + 6) % 7));

export interface EventTiming {
  starts_at: string;
  timezone: string;
  rrule: string | null;
}

/** Start times (ms) of an event's occurrences in [from, to), before exceptions. */
export function occurrences(event: EventTiming, from: number, to: number): number[] {
  const start = Date.parse(event.starts_at);
  const rule = parseRule(event.rrule);
  if (!rule) return start >= from && start < to ? [start] : [];

  const tz = event.timezone;
  const local = toWall(start, tz);
  const firstDay = dayNumber(local);
  const days = rule.byday?.map((d) => WEEKDAYS.indexOf(d)) ?? [weekday(firstDay)];

  const result: number[] = [];
  const lastDay = dayNumber(toWall(to, tz)) + 1;
  for (let n = Math.max(dayNumber(toWall(from, tz)) - 1, firstDay); n <= lastDay; n++) {
    const date = fromDayNumber(n);
    const matches =
      rule.freq === 'DAILY' ||
      (rule.freq === 'WEEKLY' && days.includes(weekday(n))) ||
      (rule.freq === 'MONTHLY' && date.day === local.day) ||
      (rule.freq === 'YEARLY' && date.day === local.day && date.month === local.month);
    if (!matches) continue;
    const occ = fromWall({ ...date, hour: local.hour, minute: local.minute, second: local.second }, tz);
    if (occ >= from && occ < to) result.push(occ);
  }
  return result;
}

export interface EventLike extends EventTiming {
  id: string;
  title: string;
  ends_at: string;
  all_day: boolean;
  location_text: string | null;
  note: string | null;
  participant_ids: string[];
  deleted_at: string | null;
}

export interface ExceptionLike {
  event_id: string;
  original_start: string;
  is_cancelled: boolean;
  override: unknown;
  deleted_at: string | null;
}

export interface Override {
  title?: string;
  starts_at?: string;
  ends_at?: string;
  location_text?: string | null;
  note?: string | null;
}

export interface Occurrence<E extends EventLike = EventLike> {
  /** Unique per occurrence: event id + original start. */
  key: string;
  event: E;
  originalStart: string;
  start: number;
  end: number;
  title: string;
  allDay: boolean;
  locationText: string | null;
  note: string | null;
  participantIds: string[];
  recurring: boolean;
}

/** All occurrences in [from, to), with exceptions applied, sorted by start. */
export function expandEvents<E extends EventLike>(
  events: E[],
  exceptions: ExceptionLike[],
  from: number,
  to: number,
): Occurrence<E>[] {
  const byKey = new Map<string, ExceptionLike>();
  for (const x of exceptions) {
    if (!x.deleted_at) byKey.set(`${x.event_id}:${Date.parse(x.original_start)}`, x);
  }

  const out: Occurrence<E>[] = [];
  for (const event of events) {
    if (event.deleted_at) continue;
    const duration = Date.parse(event.ends_at) - Date.parse(event.starts_at);
    // Look back by the duration so events that started earlier but are still on show.
    for (const start of occurrences(event, from - duration, to)) {
      const exception = byKey.get(`${event.id}:${start}`);
      if (exception?.is_cancelled) continue;
      const o = (exception?.override ?? {}) as Override;
      const s = o.starts_at ? Date.parse(o.starts_at) : start;
      const e = o.ends_at ? Date.parse(o.ends_at) : s + duration;
      if (e < from || s >= to) continue;
      out.push({
        key: `${event.id}:${start}`,
        event,
        originalStart: new Date(start).toISOString(),
        start: s,
        end: e,
        title: o.title ?? event.title,
        allDay: event.all_day,
        locationText: o.location_text !== undefined ? o.location_text : event.location_text,
        note: o.note !== undefined ? o.note : event.note,
        participantIds: event.participant_ids,
        recurring: !!event.rrule,
      });
    }
  }
  return out.sort((a, b) => a.start - b.start || a.title.localeCompare(b.title));
}

export interface BirthdayPerson {
  userId: string;
  name: string;
  /** YYYY-MM-DD */
  birthday: string;
}

export interface Birthday {
  key: string;
  userId: string;
  name: string;
  /** UTC midnight of the date, like all-day events. */
  start: number;
  age: number;
}

/** FR-5.7: birthdays as yearly all-day events; 29 Feb falls on 28 Feb in other years. */
export function birthdays(people: BirthdayPerson[], from: number, to: number): Birthday[] {
  const out: Birthday[] = [];
  const firstYear = new Date(from).getUTCFullYear();
  const lastYear = new Date(to).getUTCFullYear();
  for (const p of people) {
    const [y, m, d] = p.birthday.split('-').map(Number) as [number, number, number];
    for (let year = firstYear; year <= lastYear; year++) {
      const leap = new Date(Date.UTC(year, 1, 29)).getUTCMonth() === 1;
      const day = m === 2 && d === 29 && !leap ? 28 : d;
      const start = Date.UTC(year, m - 1, day);
      if (start + 86_400_000 > from && start < to) {
        out.push({ key: `bday:${p.userId}:${year}`, userId: p.userId, name: p.name, start, age: year - y });
      }
    }
  }
  return out.sort((a, b) => a.start - b.start);
}
