import { secureStorage } from './secure-storage';

// An invite link opened before sign-in is kept until the user can join.
const KEY = 'pending-invite';

export const pendingInvite = {
  get: () => secureStorage.getItem(KEY),
  set: (token: string) => secureStorage.setItem(KEY, token),
  clear: () => secureStorage.removeItem(KEY),
};
