import { createMemoryStore, type LocalStore } from '@family-hub/storage';

// Web is not an MVP target: an in-memory store until the v2 IndexedDB store.
const store = createMemoryStore();

export function getLocalStore(): Promise<LocalStore> {
  return Promise.resolve(store);
}
