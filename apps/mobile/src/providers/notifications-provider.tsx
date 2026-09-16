import type { ListItemRow } from '@family-hub/data';
import { router } from 'expo-router';
import { useEffect, useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform } from 'react-native';

import { useAllItems } from '@/hooks/use-lists';
import { useNow } from '@/hooks/use-now';
import { dayOf, localStartOf, DAY_MS } from '@/lib/calendar';
import { checkInFromNotification } from '@/lib/location';
import { configureNotifications, registerDevice, setBadge } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { useUserId } from '@/providers/session-provider';
import { useSync } from '@/providers/sync-provider';

type Response = import('expo-notifications').NotificationResponse;

/**
 * Registers this device for push, handles taps (FR-7.5) and action buttons
 * (FR-7.4), and keeps the icon badge at "my tasks due today" (FR-7.6).
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const userId = useUserId();
  const { engine, actions } = useSync();

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let sub: { remove(): void } | undefined;
    let cancelled = false;

    const handle = async (response: Response) => {
      const data = (response.notification.request.content.data ?? {}) as Record<string, string | undefined>;
      if (response.actionIdentifier === 'mark_done' && data.itemId) {
        const cached = engine.get('list_items', data.itemId);
        if (cached) await actions.setDone(cached as ListItemRow, true);
        else await supabase.from('list_items').update({ is_done: true }).eq('id', data.itemId);
        return;
      }
      if (response.actionIdentifier === 'check_in') {
        await checkInFromNotification();
        return;
      }
      if (data.url) router.push(data.url as never);
    };

    (async () => {
      const Notifications = await import('expo-notifications');
      await configureNotifications({ markDone: t('notifications.markDone'), checkIn: t('notifications.checkIn') });
      await registerDevice().catch(() => {});
      if (cancelled) return;
      // A tap that launched the app from a cold start.
      const last = await Notifications.getLastNotificationResponseAsync();
      if (last) {
        await handle(last);
        await Notifications.clearLastNotificationResponseAsync();
      }
      sub = Notifications.addNotificationResponseReceivedListener((r) => void handle(r));
    })();

    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, [engine, actions, t]);

  // Badge: tasks assigned to me that are due today or overdue.
  const items = useAllItems();
  const now = useNow();
  const endOfToday = localStartOf(dayOf(now, false) + DAY_MS);
  const due = useMemo(
    () =>
      items.filter(
        (i) => i.assignee_id === userId && !i.is_done && !i.deleted_at && i.due_at && Date.parse(i.due_at) < endOfToday,
      ).length,
    [items, userId, endOfToday],
  );
  useEffect(() => setBadge(due), [due]);

  return children;
}
