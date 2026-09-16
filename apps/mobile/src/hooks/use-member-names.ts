import { useMemo } from 'react';

import { useFamily, useMembers } from '@/hooks/queries';

/** Member display names by user id (empty until loaded). */
export function useMemberNames(): Map<string, string> {
  const { family } = useFamily();
  const members = useMembers(family.id);
  return useMemo(
    () => new Map((members.data ?? []).map((m) => [m.userId, m.displayName])),
    [members.data],
  );
}
