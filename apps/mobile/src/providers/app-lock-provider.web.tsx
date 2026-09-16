import type { ReactNode } from 'react';

// No biometrics on web.
export function AppLockProvider({ children }: { children: ReactNode }) {
  return children;
}
