import { useQuery } from '@tanstack/react-query';

import { useFamily } from '@/hooks/queries';
import { queryKeys } from '@/lib/query-client';
import { repos } from '@/lib/supabase';

/** Everyone's sharing settings, latest positions and check-ins; realtime keeps it fresh. */
export function useFamilyLocations() {
  const { family } = useFamily();
  return useQuery({
    queryKey: queryKeys.locations(family.id),
    queryFn: () => repos.location.familyLocations(family.id),
  });
}

export function useTrail(userId: string | null) {
  return useQuery({
    queryKey: ['trail', userId],
    queryFn: () => repos.location.trail(userId!),
    enabled: !!userId,
  });
}
