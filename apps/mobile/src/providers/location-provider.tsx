import { useEffect, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';

import { useFamilyLocations } from '@/hooks/use-locations';
import { foregroundGranted, registerBackgroundNotifications, syncTracking, watchForeground } from '@/lib/location';
import { useUserId } from '@/providers/session-provider';

/**
 * Keeps this device's tracking in step with the user's sharing mode:
 * background task for "Always", a foreground watcher for "While using".
 */
export function LocationProvider({ children }: { children: ReactNode }) {
  const userId = useUserId();
  const locations = useFamilyLocations();
  const mine = locations.data?.settings.find((s) => s.user_id === userId);
  const mode = mine?.mode ?? 'off';
  const pausedUntil = mine?.paused_until ?? null;

  useEffect(() => {
    void registerBackgroundNotifications();
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web' || !locations.data) return;
    const paused = !!pausedUntil && Date.parse(pausedUntil) > Date.now();
    void syncTracking(mode, paused).catch(() => {});
    if (mode !== 'foreground' || paused) return;

    let stop: (() => void) | null = null;
    const start = async () => {
      if (!stop && (await foregroundGranted())) stop = await watchForeground();
    };
    void start();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void start();
      else {
        stop?.();
        stop = null;
      }
    });
    return () => {
      sub.remove();
      stop?.();
    };
  }, [mode, pausedUntil, locations.data]);

  return children;
}
