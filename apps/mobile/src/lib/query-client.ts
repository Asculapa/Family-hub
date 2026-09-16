import { focusManager, QueryClient } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 2 },
  },
});

// Refetch stale queries when the app returns to the foreground.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => focusManager.setFocused(state === 'active'));
}

export const queryKeys = {
  membership: (userId: string) => ['membership', userId] as const,
  profile: (userId: string) => ['profile', userId] as const,
  members: (familyId: string) => ['members', familyId] as const,
  invites: (familyId: string) => ['invites', familyId] as const,
  activity: (familyId: string) => ['activity', familyId] as const,
  locations: (familyId: string) => ['locations', familyId] as const,
};
