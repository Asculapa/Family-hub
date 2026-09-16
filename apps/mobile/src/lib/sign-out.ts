import { unregisterDevice } from './notifications';
import { repos } from './supabase';

/** Signs out, first stopping pushes to this device (section 8). */
export async function signOut(everywhere = false) {
  if (!everywhere) await unregisterDevice();
  await repos.auth.signOut(everywhere);
}
