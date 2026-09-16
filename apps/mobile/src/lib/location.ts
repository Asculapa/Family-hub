import type { LocationMode, PositionFix } from '@family-hub/data';
import * as Battery from 'expo-battery';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { getLocalStore } from './local-store';
import { repos } from './supabase';

export const LOCATION_TASK = 'family-hub-location';

const BUFFER_KEY = 'location-buffer';
const LAST_UPLOAD_KEY = 'location-last-upload';
const UPLOAD_EVERY_MS = 60_000;
const MAX_BUFFER = 500;

const toFix = (l: Location.LocationObject): PositionFix => ({
  lat: l.coords.latitude,
  lng: l.coords.longitude,
  accuracy: l.coords.accuracy ?? null,
  recorded_at: new Date(l.timestamp).toISOString(),
});

async function batteryPct(): Promise<number | null> {
  const level = await Battery.getBatteryLevelAsync().catch(() => -1);
  return level >= 0 ? Math.round(level * 100) : null;
}

/**
 * Buffers positions in the local database and uploads them at most once a
 * minute (FR-6.4), or right away when `force` is set.
 */
export async function recordPositions(fixes: PositionFix[], force = false) {
  const store = await getLocalStore();
  const buffer = [...JSON.parse((await store.getMeta(BUFFER_KEY)) ?? '[]'), ...fixes].slice(-MAX_BUFFER);
  const last = Number((await store.getMeta(LAST_UPLOAD_KEY)) ?? 0);
  if (!force && Date.now() - last < UPLOAD_EVERY_MS) {
    await store.setMeta(BUFFER_KEY, JSON.stringify(buffer));
    return;
  }
  try {
    await repos.location.ingest(buffer, await batteryPct());
    await store.setMeta(BUFFER_KEY, '[]');
    await store.setMeta(LAST_UPLOAD_KEY, String(Date.now()));
  } catch {
    await store.setMeta(BUFFER_KEY, JSON.stringify(buffer)); // retried with the next batch
  }
}

// Background updates (FR-6.3); defined at startup so the OS can relaunch into it.
TaskManager.defineTask<{ locations: Location.LocationObject[] }>(LOCATION_TASK, async ({ data, error }) => {
  if (error || !data?.locations?.length) return;
  await recordPositions(data.locations.map(toFix));
});

export async function foregroundGranted() {
  return (await Location.getForegroundPermissionsAsync()).granted;
}
export async function backgroundGranted() {
  return (await Location.getBackgroundPermissionsAsync()).granted;
}
/** Call after the in-app explanation (FR-6.1). */
export async function requestForeground() {
  return (await Location.requestForegroundPermissionsAsync()).granted;
}
/** "Always", after the second explanation (FR-6.2). */
export async function requestBackground() {
  return (await Location.requestBackgroundPermissionsAsync()).granted;
}

/** Starts or stops the background task to match the sharing mode. */
export async function syncTracking(mode: LocationMode, paused: boolean) {
  const running = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK).catch(() => false);
  const want = mode === 'always' && !paused && (await backgroundGranted());
  if (want && !running) {
    await Location.startLocationUpdatesAsync(LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: 100,
      deferredUpdatesInterval: 5 * 60_000,
      pausesUpdatesAutomatically: true,
      activityType: Location.LocationActivityType.Other,
      showsBackgroundLocationIndicator: false,
      foregroundService: {
        notificationTitle: 'Family Hub',
        notificationBody: 'Sharing location with family',
        notificationColor: '#2563EB',
      },
    });
  } else if (!want && running) {
    await Location.stopLocationUpdatesAsync(LOCATION_TASK);
  }
}

/** Watches position while the app is open ("While using" sharing). Returns a stop function. */
export async function watchForeground(): Promise<() => void> {
  const sub = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.Balanced, distanceInterval: 100, timeInterval: 5 * 60_000 },
    (l) => void recordPositions([toFix(l)]),
  );
  return () => sub.remove();
}

/** A fresh position, uploaded now: for "Where are you?" and pull to refresh. */
export async function sendCurrentPosition() {
  if (!(await foregroundGranted())) return;
  const l = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  await recordPositions([toFix(l)], true);
}

async function currentPosition() {
  if (!(await foregroundGranted())) return null;
  const l = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).catch(() => null);
  return l ? { lat: l.coords.latitude, lng: l.coords.longitude, accuracy: l.coords.accuracy ?? null } : null;
}

/** Manual check-in (FR-6.6), with the position when permitted. */
export async function checkIn(note: string | null) {
  return repos.location.checkIn(await currentPosition(), note);
}

/** The "Check in" action on a "Where are you?" notification. */
export async function checkInFromNotification() {
  await checkIn(null);
}

// Silent "location_refresh" pushes wake the app to send a position (FR-6.7).
const NOTIFICATION_TASK = 'family-hub-notification';
TaskManager.defineTask<Record<string, unknown>>(NOTIFICATION_TASK, async ({ data }) => {
  if (notificationType(data) === 'location_refresh') await sendCurrentPosition().catch(() => {});
});

/** Payload shape differs by platform; find the "type" we put in the push data. */
function notificationType(payload: Record<string, unknown> | undefined): string | undefined {
  if (!payload) return undefined;
  const inner = (payload.data ?? payload) as Record<string, unknown>;
  if (typeof inner.type === 'string') return inner.type;
  for (const key of ['body', 'dataString']) {
    const raw = inner[key];
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw) as { type?: string };
        if (parsed.type) return parsed.type;
      } catch {
        // not JSON
      }
    }
  }
  const nested = (inner.notification as { data?: { type?: string } } | undefined)?.data?.type;
  return nested;
}

export async function registerBackgroundNotifications() {
  if (Platform.OS === 'web') return;
  const Notifications = await import('expo-notifications');
  await Notifications.registerTaskAsync(NOTIFICATION_TASK).catch(() => {});
}
