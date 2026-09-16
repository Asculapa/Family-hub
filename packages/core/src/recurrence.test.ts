import { describe, expect, it } from 'vitest';

import { birthdays, buildRule, expandEvents, occurrences, parseRule, type EventLike } from './recurrence';
import { fromWall, toWall } from './time';

const iso = (s: string) => Date.parse(s);
const list = (ms: number[]) => ms.map((m) => new Date(m).toISOString());

const event = (overrides: Partial<EventLike>): EventLike => ({
  id: 'e1',
  title: 'Swim',
  starts_at: '2026-10-05T06:00:00Z',
  ends_at: '2026-10-05T07:00:00Z',
  timezone: 'Europe/Kyiv',
  rrule: 'FREQ=WEEKLY;BYDAY=MO,TH',
  all_day: false,
  location_text: null,
  note: null,
  participant_ids: [],
  deleted_at: null,
  ...overrides,
});

describe('time zones', () => {
  it('converts between instants and wall time across DST', () => {
    expect(toWall(iso('2026-10-26T07:00:00Z'), 'Europe/Kyiv')).toMatchObject({ day: 26, hour: 9 });
    expect(new Date(fromWall({ year: 2026, month: 10, day: 19, hour: 9, minute: 0, second: 0 }, 'Europe/Kyiv')).toISOString())
      .toBe('2026-10-19T06:00:00.000Z');
  });
});

describe('rules', () => {
  it('round-trips and orders weekdays Monday first', () => {
    expect(buildRule({ freq: 'WEEKLY', byday: ['SU', 'MO'] })).toBe('FREQ=WEEKLY;BYDAY=MO,SU');
    expect(parseRule('FREQ=WEEKLY;BYDAY=MO,TH')).toEqual({ freq: 'WEEKLY', byday: ['MO', 'TH'] });
    expect(parseRule(null)).toBeNull();
    expect(buildRule({ freq: 'DAILY', byday: ['MO'] })).toBe('FREQ=DAILY');
  });
});

// Same cases as supabase/tests/calendar_test.sql, so client and server agree.
describe('occurrences', () => {
  it('keeps the wall-clock time across the DST change', () => {
    expect(list(occurrences(event({}), iso('2026-10-19'), iso('2026-10-31')))).toEqual([
      '2026-10-19T06:00:00.000Z',
      '2026-10-22T06:00:00.000Z',
      '2026-10-26T07:00:00.000Z',
      '2026-10-29T07:00:00.000Z',
    ]);
  });

  it('has no occurrences before the first one', () => {
    expect(occurrences(event({}), iso('2026-10-01'), iso('2026-10-05'))).toEqual([]);
  });

  it('skips months without that day', () => {
    const rent = event({ starts_at: '2026-01-31T08:00:00Z', timezone: 'UTC', rrule: 'FREQ=MONTHLY' });
    expect(list(occurrences(rent, iso('2026-02-01'), iso('2026-06-01')))).toEqual([
      '2026-03-31T08:00:00.000Z',
      '2026-05-31T08:00:00.000Z',
    ]);
  });

  it('defaults weekly repeats to the first day', () => {
    const e = event({ rrule: 'FREQ=WEEKLY' });
    expect(occurrences(e, iso('2026-10-05'), iso('2026-10-20'))).toHaveLength(3);
  });
});

describe('expandEvents', () => {
  it('applies cancelled and edited occurrences', () => {
    const swim = event({});
    const result = expandEvents(
      [swim],
      [
        { event_id: 'e1', original_start: '2026-10-19T06:00:00Z', is_cancelled: true, override: {}, deleted_at: null },
        {
          event_id: 'e1',
          original_start: '2026-10-22T06:00:00Z',
          is_cancelled: false,
          override: { title: 'Swim gala', starts_at: '2026-10-22T08:00:00Z', ends_at: '2026-10-22T11:00:00Z' },
          deleted_at: null,
        },
      ],
      iso('2026-10-19'),
      iso('2026-10-24'),
    );
    expect(result.map((o) => [o.title, new Date(o.start).toISOString(), (o.end - o.start) / 3600_000])).toEqual([
      ['Swim gala', '2026-10-22T08:00:00.000Z', 3],
    ]);
  });

  it('includes events already in progress at the start of the range', () => {
    const trip = event({ rrule: null, starts_at: '2026-10-01T00:00:00Z', ends_at: '2026-10-10T00:00:00Z' });
    expect(expandEvents([trip], [], iso('2026-10-05'), iso('2026-10-06'))).toHaveLength(1);
  });

  it('skips deleted events', () => {
    expect(expandEvents([event({ deleted_at: 'x' })], [], iso('2026-10-01'), iso('2026-11-01'))).toEqual([]);
  });
});

describe('birthdays', () => {
  it('repeats yearly and moves 29 February in non-leap years', () => {
    const result = birthdays(
      [{ userId: 'u1', name: 'Kira', birthday: '2016-02-29' }],
      iso('2027-01-01'),
      iso('2028-12-31'),
    );
    expect(result.map((b) => [new Date(b.start).toISOString().slice(0, 10), b.age])).toEqual([
      ['2027-02-28', 11],
      ['2028-02-29', 12],
    ]);
  });
});
