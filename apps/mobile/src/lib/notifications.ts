import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { secureStorage } from './secure-storage';
import { repos } from './supabase';

const TOKEN_KEY = 'push-token';

export type PermissionState = 'granted' | 'denied' | 'undetermined';

/** Foreground display, Android channel and action buttons (FR-7.4). */
export async function configureNotifications(labels: { markDone: string; checkIn: string }) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Family Hub',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  await Notifications.setNotificationCategoryAsync('task', [
    { identifier: 'mark_done', buttonTitle: labels.markDone, options: { opensAppToForeground: false } },
  ]);
  await Notifications.setNotificationCategoryAsync('location_request', [
    { identifier: 'check_in', buttonTitle: labels.checkIn, options: { opensAppToForeground: false } },
  ]);
}

export async function permissionState(): Promise<PermissionState> {
  const { status } = await Notifications.getPermissionsAsync();
  return status as PermissionState;
}

/** Asks the OS; call only after explaining why (FR-7.1). */
export async function requestPermission(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/** Saves this device's push token for the signed-in user, when allowed. */
export async function registerDevice(): Promise<void> {
  if (!Device.isDevice || (await permissionState()) !== 'granted') return;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
  if (!projectId) {
    console.warn('Push notifications need an EAS project id (EAS_PROJECT_ID); run `eas init`.');
    return;
  }
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  await repos.notifications.registerDevice(token, Platform.OS === 'ios' ? 'ios' : 'android', Device.deviceName);
  await secureStorage.setItem(TOKEN_KEY, token);
}

/** Stops pushes to this device, e.g. before signing out. */
export async function unregisterDevice(): Promise<void> {
  const token = await secureStorage.getItem(TOKEN_KEY);
  if (!token) return;
  await repos.notifications.unregisterDevice(token).catch(() => {});
  await secureStorage.removeItem(TOKEN_KEY);
}

export function setBadge(count: number) {
  void Notifications.setBadgeCountAsync(count).catch(() => {});
}

export { Notifications };
