// Web push arrives in v2 (spec section 8); these keep the same interface.
export type PermissionState = 'granted' | 'denied' | 'undetermined';

export async function configureNotifications(_labels: { markDone: string; checkIn: string }) {}
export async function permissionState(): Promise<PermissionState> {
  return 'denied';
}
export async function requestPermission(): Promise<boolean> {
  return false;
}
export async function registerDevice(): Promise<void> {}
export async function unregisterDevice(): Promise<void> {}
export function setBadge(_count: number) {}
