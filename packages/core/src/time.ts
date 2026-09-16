/** Time-zone math with Intl only (no tz database bundled). */

export interface WallTime {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string) {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
    formatters.set(tz, f);
  }
  return f;
}

/** Wall-clock time of an instant in a time zone. */
export function toWall(ms: number, tz: string): WallTime {
  const parts = Object.fromEntries(
    formatter(tz)
      .formatToParts(new Date(ms))
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, Number(p.value)]),
  );
  return {
    year: parts.year!,
    month: parts.month!,
    day: parts.day!,
    hour: parts.hour! % 24,
    minute: parts.minute!,
    second: parts.second!,
  };
}

const wallMs = (w: WallTime) => Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);

/** Offset of a time zone from UTC at an instant, in ms. */
export function tzOffset(ms: number, tz: string): number {
  return wallMs(toWall(ms, tz)) - Math.floor(ms / 1000) * 1000;
}

/** The instant a wall-clock time happens in a time zone. */
export function fromWall(w: WallTime, tz: string): number {
  const guess = wallMs(w);
  const first = guess - tzOffset(guess, tz);
  const second = guess - tzOffset(first, tz);
  return first === second ? first : second;
}

/** Days since the Unix epoch for a calendar date; 0 = Thursday. */
export const dayNumber = (w: Pick<WallTime, 'year' | 'month' | 'day'>) =>
  Math.floor(Date.UTC(w.year, w.month - 1, w.day) / 86_400_000);

export function fromDayNumber(n: number): Pick<WallTime, 'year' | 'month' | 'day'> {
  const d = new Date(n * 86_400_000);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/** 0 = Sunday … 6 = Saturday. */
export const weekday = (dayNum: number) => (dayNum + 4) % 7;
