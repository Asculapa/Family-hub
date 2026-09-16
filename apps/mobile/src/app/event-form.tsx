import {
  buildRule,
  can,
  FREQUENCIES,
  parseRule,
  WEEKDAYS,
  type Frequency,
  type Override,
  type Weekday,
} from '@family-hub/core';
import type { EventInput, EventRow } from '@family-hub/data';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { closeScreen } from '@/lib/navigation';
import { Chips } from '@/components/ui/chips';
import { DateTimeField } from '@/components/ui/date-time-field';
import { MultiChips } from '@/components/ui/multi-chips';
import { Notice } from '@/components/ui/notice';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { TextField } from '@/components/ui/text-field';
import { useFamily, useMembers } from '@/hooks/queries';
import { useEvent } from '@/hooks/use-calendar';
import { deviceTimeZone } from '@/lib/calendar';
import { choose } from '@/lib/choose';
import { confirm } from '@/lib/confirm';
import { useUserId } from '@/providers/session-provider';
import { useSync } from '@/providers/sync-provider';

const HOUR = 3_600_000;
const MONDAY_FIRST: Weekday[] = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

/** Local Date for the calendar date of a UTC-midnight instant (all-day events). */
const utcDateToLocal = (ms: number) => {
  const d = new Date(ms);
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};
const localDateToUtc = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());

interface FormState {
  title: string;
  allDay: boolean;
  start: Date;
  end: Date;
  freq: Frequency | null;
  byday: Weekday[];
  participants: string[];
  location: string;
  note: string;
  reminder: number | null;
}

/**
 * Create an event, or edit one (id) — for a recurring event, the occurrence
 * that started at `start` (FR-5.2, FR-5.3).
 */
export default function EventFormScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ id?: string; start?: string; day?: string }>();
  const event = useEvent(params.id ?? '');

  if (params.id && (!event || event.deleted_at)) {
    return (
      <Screen modal>
        <Notice tone="info" message={t('calendar.form.notFound')} />
      </Screen>
    );
  }
  return <EventForm event={event} occurrenceStart={params.start} day={params.day ? Number(params.day) : undefined} />;
}

function EventForm({ event, occurrenceStart, day }: { event?: EventRow; occurrenceStart?: string; day?: number }) {
  const { t } = useTranslation();
  const userId = useUserId();
  const { family, role } = useFamily();
  const members = useMembers(family.id);
  const { engine, calendar } = useSync();
  const exceptions = useSyncExternalStore(engine.subscribe, () => engine.rows('event_exceptions'));

  const recurringOccurrence = !!event?.rrule && !!occurrenceStart;
  const editable = !event || can(role, 'event.edit') || event.created_by === userId;

  const [initial] = useState((): FormState => {
    if (!event) {
      const now = Date.now();
      const nextHour = Math.ceil(now / HOUR) * HOUR;
      const start = day && day > now ? new Date(utcDateToLocal(day).getTime() + 9 * HOUR) : new Date(nextHour);
      return {
        title: '',
        allDay: false,
        start,
        end: new Date(start.getTime() + HOUR),
        freq: null,
        byday: [],
        participants: [userId],
        location: '',
        note: '',
        reminder: null,
      };
    }
    const exception = occurrenceStart
      ? exceptions.find((x) => x.event_id === event.id && Date.parse(x.original_start) === Date.parse(occurrenceStart))
      : undefined;
    const o = (exception?.override ?? {}) as Override;
    const duration = Date.parse(event.ends_at) - Date.parse(event.starts_at);
    const start = Date.parse(o.starts_at ?? occurrenceStart ?? event.starts_at);
    const end = o.ends_at ? Date.parse(o.ends_at) : start + duration;
    const rule = parseRule(event.rrule);
    return {
      title: o.title ?? event.title,
      allDay: event.all_day,
      start: event.all_day ? utcDateToLocal(start) : new Date(start),
      end: event.all_day ? utcDateToLocal(end) : new Date(end),
      freq: rule?.freq ?? null,
      byday: rule?.byday ?? [],
      participants: event.participant_ids,
      location: (o.location_text !== undefined ? o.location_text : event.location_text) ?? '',
      note: (o.note !== undefined ? o.note : event.note) ?? '',
      reminder: event.reminder_minutes,
    };
  });

  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<{ title?: string; end?: string }>({});
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const startMs = form.allDay ? localDateToUtc(form.start) : form.start.getTime();
  const endMs = form.allDay ? localDateToUtc(form.end) : form.end.getTime();

  const toInput = (): EventInput => ({
    title: form.title,
    startsAt: new Date(startMs).toISOString(),
    endsAt: new Date(endMs).toISOString(),
    allDay: form.allDay,
    timezone: event && !event.all_day ? event.timezone : deviceTimeZone(),
    rrule: buildRule(form.freq ? { freq: form.freq, byday: form.byday } : null),
    participantIds: form.participants,
    locationText: form.location,
    note: form.note,
    reminderMinutes: form.reminder,
  });

  const save = async () => {
    const next = {
      title: form.title.trim() ? undefined : t('validation.required'),
      end: endMs < startMs ? t('calendar.form.endBeforeStart') : undefined,
    };
    setErrors(next);
    if (next.title || next.end) return;

    if (!event) {
      await calendar.createEvent(toInput());
      return closeScreen();
    }
    if (recurringOccurrence) {
      const scope = await choose(t('calendar.form.scopeTitle'), t('calendar.form.scopeSave'), [
        { label: t('common.cancel'), value: 'cancel' as const, style: 'cancel' },
        { label: t('calendar.form.thisEvent'), value: 'this' as const },
        { label: t('calendar.form.allEvents'), value: 'all' as const },
      ]);
      if (scope === 'cancel') return;
      if (scope === 'this') {
        await calendar.editOccurrence(event, occurrenceStart!, {
          title: form.title.trim(),
          starts_at: new Date(startMs).toISOString(),
          ends_at: new Date(endMs).toISOString(),
          location_text: form.location.trim() || null,
          note: form.note.trim() || null,
        });
        return closeScreen();
      }
      // All events: shift the series by however much this occurrence moved.
      const shift = startMs - Date.parse(initialStart(initial, event.all_day));
      const seriesStart = Date.parse(event.starts_at) + shift;
      const input = toInput();
      await calendar.updateEvent(event.id, {
        ...input,
        startsAt: new Date(seriesStart).toISOString(),
        endsAt: new Date(seriesStart + (endMs - startMs)).toISOString(),
      });
      return closeScreen();
    }
    await calendar.updateEvent(event.id, toInput());
    closeScreen();
  };

  const remove = async () => {
    if (!event) return;
    if (recurringOccurrence) {
      const scope = await choose(t('calendar.form.scopeTitle'), t('calendar.form.scopeDelete'), [
        { label: t('common.cancel'), value: 'cancel' as const, style: 'cancel' },
        { label: t('calendar.form.thisEvent'), value: 'this' as const },
        { label: t('calendar.form.allEvents'), value: 'all' as const, style: 'destructive' },
      ]);
      if (scope === 'this') await calendar.cancelOccurrence(event, occurrenceStart!);
      if (scope === 'all') await calendar.deleteEvent(event.id);
      if (scope !== 'cancel') closeScreen();
      return;
    }
    const ok = await confirm(
      t('calendar.form.delete'),
      t('calendar.form.deleteConfirm', { title: event.title }),
      t('calendar.form.delete'),
      t('common.cancel'),
    );
    if (ok) {
      await calendar.deleteEvent(event.id);
      closeScreen();
    }
  };

  return (
    <Screen modal>
      <Stack.Screen options={{ title: event ? t('calendar.form.editTitle') : t('calendar.form.newTitle') }} />
      {!editable ? <Notice tone="info" message={t('calendar.form.readOnly')} /> : null}
      <TextField
        label={t('calendar.form.title')}
        placeholder={t('calendar.form.titlePlaceholder')}
        value={form.title}
        onChangeText={(v) => set('title', v)}
        error={errors.title}
        editable={editable}
        maxLength={200}
        autoFocus={!event}
      />
      <Segmented
        options={[
          { value: 'timed', label: t('calendar.form.timed') },
          { value: 'allDay', label: t('calendar.form.allDay') },
        ]}
        value={form.allDay ? 'allDay' : 'timed'}
        onChange={(v) => set('allDay', v === 'allDay')}
      />
      <DateTimeField
        key={`start-${form.allDay}`}
        label={form.allDay ? t('calendar.form.date') : t('calendar.form.start')}
        mode={form.allDay ? 'date' : 'datetime'}
        value={form.start}
        onChange={(d) => {
          // Keep the duration when the start moves.
          const duration = form.end.getTime() - form.start.getTime();
          setForm((f) => ({ ...f, start: d, end: new Date(d.getTime() + Math.max(duration, 0)) }));
        }}
      />
      <DateTimeField
        key={`end-${form.allDay}-${form.start.getTime()}`}
        label={form.allDay ? t('calendar.form.endDate') : t('calendar.form.end')}
        mode={form.allDay ? 'date' : 'datetime'}
        value={form.end}
        error={errors.end}
        onChange={(d) => set('end', d)}
      />
      <Chips
        label={t('calendar.form.repeat')}
        value={form.freq}
        onChange={(v) => set('freq', v)}
        options={[
          { value: null, label: t('calendar.form.repeatNone') },
          ...FREQUENCIES.map((f) => ({ value: f, label: t(`calendar.form.${f}`) })),
        ]}
      />
      {form.freq === 'WEEKLY' ? (
        <MultiChips
          label={t('calendar.form.weekdays')}
          value={form.byday.length ? form.byday : [WEEKDAYS[form.start.getDay()]!]}
          onChange={(v) => set('byday', v)}
          options={MONDAY_FIRST.map((d) => ({ value: d, label: t(`calendar.weekdayShort.${d}`) }))}
        />
      ) : null}
      <MultiChips
        label={t('calendar.form.participants')}
        value={form.participants}
        onChange={(v) => set('participants', v)}
        options={(members.data ?? []).map((m) => ({ value: m.userId, label: m.displayName, color: m.color }))}
      />
      <Chips
        label={t('calendar.form.reminder')}
        value={form.reminder === null ? null : String(form.reminder)}
        onChange={(v) => set('reminder', v === null ? null : Number(v))}
        options={[
          { value: null, label: t('calendar.form.reminderNone') },
          { value: '10', label: t('calendar.form.reminder10') },
          { value: '60', label: t('calendar.form.reminder60') },
          { value: '1440', label: t('calendar.form.reminder1440') },
        ]}
      />
      <TextField
        label={t('calendar.form.location')}
        value={form.location}
        onChangeText={(v) => set('location', v)}
        editable={editable}
        maxLength={200}
      />
      <TextField
        label={t('calendar.form.note')}
        value={form.note}
        onChangeText={(v) => set('note', v)}
        editable={editable}
        multiline
        maxLength={2000}
        style={{ minHeight: 88, paddingTop: 12, textAlignVertical: 'top' }}
      />
      {editable ? (
        <>
          <Button title={event ? t('calendar.form.save') : t('calendar.form.create')} onPress={save} />
          {event ? <Button title={t('calendar.form.delete')} variant="danger" onPress={remove} /> : null}
        </>
      ) : null}
    </Screen>
  );
}

/** ISO start the form opened with, in the same units the form saves. */
function initialStart(initial: FormState, allDay: boolean): string {
  return new Date(allDay ? localDateToUtc(initial.start) : initial.start.getTime()).toISOString();
}
