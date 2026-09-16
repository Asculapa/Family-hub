import * as LocalAuthentication from 'expo-local-authentication';

import { secureStorage } from './secure-storage';

const KEY = 'app-lock';

/** Biometric app lock setting (FR-1.4), per device. */
export const appLock = {
  async enabled() {
    return (await secureStorage.getItem(KEY)) === '1';
  },
  async setEnabled(on: boolean) {
    if (on) await secureStorage.setItem(KEY, '1');
    else await secureStorage.removeItem(KEY);
  },
  /** Face ID / fingerprint hardware exists and is enrolled. */
  async available() {
    return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
  },
  async authenticate(prompt: string) {
    const result = await LocalAuthentication.authenticateAsync({ promptMessage: prompt });
    return result.success;
  },
};
