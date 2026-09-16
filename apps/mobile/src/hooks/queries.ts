import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/lib/query-client';
import { repos } from '@/lib/supabase';
import { useSession, useUserId } from '@/providers/session-provider';

export function useMembership() {
  const { session } = useSession();
  const userId = session?.user.id;
  return useQuery({
    queryKey: queryKeys.membership(userId ?? ''),
    queryFn: () => repos.families.getMembership(userId!),
    enabled: !!userId,
  });
}

/** The current family and role; only call below the family guard. */
export function useFamily() {
  const { data } = useMembership();
  if (!data) throw new Error('useFamily called without a family');
  return data;
}

export function useProfile() {
  const userId = useUserId();
  return useQuery({
    queryKey: queryKeys.profile(userId),
    queryFn: () => repos.profiles.get(userId),
  });
}

export function useMembers(familyId: string) {
  return useQuery({
    queryKey: queryKeys.members(familyId),
    queryFn: () => repos.families.listMembers(familyId),
  });
}

export function useInvites(familyId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.invites(familyId),
    queryFn: () => repos.families.listInvites(familyId),
    enabled,
  });
}
