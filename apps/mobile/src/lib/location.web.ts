import type { LocationMode, PositionFix } from '@family-hub/data';

import { repos } from './supabase';

// Web views the family map only (spec section 8); no sharing from the browser in the MVP.
export const LOCATION_TASK = 'family-hub-location';
export async function recordPositions(_fixes: PositionFix[], _force = false) {}
export async function foregroundGranted() {
  return false;
}
export async function backgroundGranted() {
  return false;
}
export async function requestForeground() {
  return false;
}
export async function requestBackground() {
  return false;
}
export async function syncTracking(_mode: LocationMode, _paused: boolean) {}
export async function watchForeground(): Promise<() => void> {
  return () => {};
}
export async function sendCurrentPosition() {}
export async function checkIn(note: string | null) {
  return repos.location.checkIn(null, note);
}
export async function checkInFromNotification() {
  await checkIn(null);
}
export async function registerBackgroundNotifications() {}
