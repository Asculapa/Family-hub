import { createSqliteStore, type LocalStore } from '@family-hub/storage';
import { openDatabaseAsync } from 'expo-sqlite';

let store: Promise<LocalStore> | undefined;

/** The on-device database (FR-3.8): lists render from it, online or offline. */
export function getLocalStore(): Promise<LocalStore> {
  store ??= openDatabaseAsync('familyhub.db').then(createSqliteStore);
  return store;
}
