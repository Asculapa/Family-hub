import { birthdays, expandEvents, type Birthday, type Occurrence } from '@family-hub/core';
import type { EventRow } from '@family-hub/data';
import { useMemo, useSyncExternalStore } from 'react';

import { useFamily, useMembers } from '@/hooks/queries';
import { useSync } from '@/providers/sync-provider';

export function useEvents(): EventRow[] {
  const { engine } = useSync();
  return useSyncExternalStore(engine.subscribe, () => engine.rows('events'));
}

export function useEvent(id: string): EventRow | undefined {
  const events = useEvents();
  return useMemo(() => events.find((e) => e.id === id), [events, id]);
}

/** Occurrences in [from, to), optionally only those a member takes part in (FR-5.4). */
export function useOccurrences(from: number, to: number, memberId: string | null): Occurrence<EventRow>[] {
  const { engine } = useSync();
  const events = useEvents();
  const exceptions = useSyncExternalStore(engine.subscribe, () => engine.rows('event_exceptions'));
  return useMemo(() => {
    const all = expandEvents(events, exceptions, from, to);
    return memberId ? all.filter((o) => o.participantIds.includes(memberId)) : all;
  }, [events, exceptions, from, to, memberId]);
}

/** Member birthdays in range (FR-5.7). */
export function useBirthdays(from: number, to: number, memberId: string | null): Birthday[] {
  const { family } = useFamily();
  const members = useMembers(family.id);
  return useMemo(() => {
    const people = (members.data ?? [])
      .filter((m) => m.birthday && (!memberId || m.userId === memberId))
      .map((m) => ({ userId: m.userId, name: m.displayName, birthday: m.birthday! }));
    return birthdays(people, from, to);
  }, [members.data, from, to, memberId]);
}

/** Member colors by id; events use their first participant's color (FR-5.4). */
export function useMemberColors(): Map<string, string | null> {
  const { family } = useFamily();
  const members = useMembers(family.id);
  return useMemo(() => new Map((members.data ?? []).map((m) => [m.userId, m.color])), [members.data]);
}
