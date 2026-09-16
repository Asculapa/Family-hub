import type { Session } from '@family-hub/data';
import { createContext, use, useEffect, useState, type ReactNode } from 'react';

import { getLocalStore } from '@/lib/local-store';
import { queryClient } from '@/lib/query-client';
import { supabase } from '@/lib/supabase';

interface SessionState {
  session: Session | null;
  /** True until the stored session has been read. */
  loading: boolean;
}

const SessionContext = createContext<SessionState>({ session: null, loading: true });

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ session: null, loading: true });

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setState({ session, loading: false });
      if (event === 'SIGNED_OUT') {
        queryClient.clear();
        // Family data must not stay on a signed-out device.
        void getLocalStore().then((store) => store.clear());
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  return <SessionContext value={state}>{children}</SessionContext>;
}

export function useSession() {
  return use(SessionContext);
}

/** The signed-in user's id; only call below a session guard. */
export function useUserId(): string {
  const { session } = useSession();
  if (!session) throw new Error('useUserId called without a session');
  return session.user.id;
}
