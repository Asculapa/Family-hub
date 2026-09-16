import {
  createCalendarActions,
  createListActions,
  type CalendarActions,
  createSyncEngine,
  toAppError,
  type ListActions,
  type SyncEngine,
  type SyncRow,
  type SyncTable,
  SYNC_TABLES,
} from '@family-hub/data';
import { createContext, use, useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, AppState } from 'react-native';

import { getLocalStore } from '@/lib/local-store';
import { queryClient, queryKeys } from '@/lib/query-client';
import { repos, supabase } from '@/lib/supabase';
import { newId } from '@/lib/uuid';

interface SyncContextValue {
  engine: SyncEngine;
  actions: ListActions;
  calendar: CalendarActions;
}

const SyncContext = createContext<SyncContextValue | null>(null);

const RETRY_MS = 15_000;

/**
 * Runs the sync engine for the current family: loads the local database,
 * flushes and pulls on start, foreground and reconnect, and applies realtime
 * changes while the app is in the foreground (spec section 9).
 */
export function SyncProvider({ familyId, userId, children }: { familyId: string; userId: string; children: ReactNode }) {
  const { t } = useTranslation();
  const [value, setValue] = useState<SyncContextValue | null>(null);

  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let engine: SyncEngine | null = null;

    const subscribe = () => {
      if (!engine || channel) return;
      const e = engine;
      channel = supabase.channel(`family:${familyId}`);
      for (const table of SYNC_TABLES) {
        channel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table, filter: `family_id=eq.${familyId}` },
          (payload) => {
            if (payload.new && 'id' in payload.new) void e.applyRemote(table, payload.new as SyncRow<SyncTable>);
          },
        );
      }
      channel.on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_log', filter: `family_id=eq.${familyId}` },
        () => void queryClient.invalidateQueries({ queryKey: queryKeys.activity(familyId) }),
      );
      for (const table of ['location_latest', 'location_settings', 'check_ins'] as const) {
        channel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table, filter: `family_id=eq.${familyId}` },
          () => void queryClient.invalidateQueries({ queryKey: queryKeys.locations(familyId) }),
        );
      }
      // (Re)connected: catch up on anything missed while disconnected.
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') void e.sync().catch(() => {});
      });
    };
    const unsubscribe = () => {
      if (channel) void supabase.removeChannel(channel);
      channel = null;
    };

    (async () => {
      const store = await getLocalStore();
      const e = createSyncEngine({
        store,
        remote: repos.syncRemote,
        familyId,
        newId,
        onRejected: (error) => Alert.alert(t('lists.syncRejected'), t(`errors.${error.code}`)),
      });
      await e.start();
      if (cancelled) return;
      engine = e;
      setValue({
        engine: e,
        actions: createListActions(e, { userId, newId }),
        calendar: createCalendarActions(e, { userId, newId }),
      });
      subscribe();
    })().catch((error) => Alert.alert(t(`errors.${toAppError(error).code}`)));

    // Save battery in the background: push and the next pull cover the rest.
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        subscribe();
        void engine?.sync().catch(() => {});
      } else {
        unsubscribe();
      }
    });
    const retry = setInterval(() => {
      if (engine && engine.pendingCount() > 0) void engine.flush();
    }, RETRY_MS);

    return () => {
      cancelled = true;
      appState.remove();
      clearInterval(retry);
      unsubscribe();
    };
  }, [familyId, userId, t]);

  if (!value) return null;
  return <SyncContext value={value}>{children}</SyncContext>;
}

export function useSync(): SyncContextValue {
  const value = use(SyncContext);
  if (!value) throw new Error('useSync called outside SyncProvider');
  return value;
}
