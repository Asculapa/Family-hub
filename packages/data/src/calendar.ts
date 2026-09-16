import type { Override } from '@family-hub/core';

import type { SyncEngine } from './sync/engine';
import type { EventExceptionRow, EventRow } from './sync/types';

export interface EventInput {
  title: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  timezone: string;
  rrule: string | null;
  participantIds: string[];
  locationText: string | null;
  note: string | null;
  reminderMinutes: number | null;
}

const toColumns = (i: EventInput) => ({
  title: i.title.trim(),
  starts_at: i.startsAt,
  ends_at: i.endsAt,
  all_day: i.allDay,
  // All-day events are stored as UTC dates so everyone sees the same day (FR-5.6).
  timezone: i.allDay ? 'UTC' : i.timezone,
  rrule: i.rrule,
  participant_ids: i.participantIds,
  location_text: i.locationText?.trim() || null,
  note: i.note?.trim() || null,
  reminder_minutes: i.reminderMinutes,
});

/** Calendar writes through the sync engine (FR-5.2, FR-5.3). */
export function createCalendarActions(
  engine: SyncEngine,
  { userId, newId, now = () => new Date() }: { userId: string; newId: () => string; now?: () => Date },
) {
  const stamp = () => now().toISOString();

  async function exceptionFor(event: EventRow, originalStart: string, changes: Partial<EventExceptionRow>) {
    const existing = engine
      .rows('event_exceptions')
      .find((x) => x.event_id === event.id && Date.parse(x.original_start) === Date.parse(originalStart));
    if (existing) {
      await engine.update('event_exceptions', existing.id, { ...changes, deleted_at: null });
      return;
    }
    const t = stamp();
    await engine.insert('event_exceptions', {
      id: newId(),
      event_id: event.id,
      family_id: engine.familyId,
      original_start: originalStart,
      is_cancelled: false,
      override: {},
      created_at: t,
      updated_at: t,
      deleted_at: null,
      ...changes,
    });
  }

  return {
    async createEvent(input: EventInput): Promise<EventRow> {
      const t = stamp();
      const row: EventRow = {
        id: newId(),
        family_id: engine.familyId,
        ...toColumns(input),
        created_by: userId,
        created_at: t,
        updated_at: t,
        deleted_at: null,
      };
      await engine.insert('events', row);
      return row;
    },

    /** "All events": changes the event itself. */
    updateEvent(id: string, input: EventInput) {
      return engine.update('events', id, toColumns(input));
    },

    /** "This event": changes one occurrence of a recurring event. */
    editOccurrence(event: EventRow, originalStart: string, override: Override) {
      return exceptionFor(event, originalStart, { override: override as EventExceptionRow['override'] });
    },

    cancelOccurrence(event: EventRow, originalStart: string) {
      return exceptionFor(event, originalStart, { is_cancelled: true });
    },

    deleteEvent(id: string) {
      return engine.update('events', id, { deleted_at: stamp() });
    },
  };
}

export type CalendarActions = ReturnType<typeof createCalendarActions>;
