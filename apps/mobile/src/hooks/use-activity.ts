import { useQuery } from '@tanstack/react-query';

import { useFamily } from '@/hooks/queries';
import { queryKeys } from '@/lib/query-client';
import { repos } from '@/lib/supabase';

/** Family activity, newest first; refreshed by realtime inserts (see SyncProvider). */
export function useActivity(limit = 100) {
  const { family } = useFamily();
  return useQuery({
    queryKey: [...queryKeys.activity(family.id), limit],
    queryFn: () => repos.activity.list(family.id, limit),
  });
}
