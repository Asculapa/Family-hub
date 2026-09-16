import type { SupabaseClient } from './client';
import { check, toAppError, unwrap } from './errors';

export function createAuthRepository(client: SupabaseClient, redirectTo: string) {
  return {
    async signUp(email: string, password: string, displayName: string) {
      const data = unwrap(
        await client.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirectTo, data: { full_name: displayName } },
        }),
      );
      // Supabase returns a user with no identities when the email is already registered.
      if (data.user && data.user.identities?.length === 0) {
        throw toAppError({ code: 'user_already_exists' });
      }
      return { needsConfirmation: !data.session };
    },

    async signIn(email: string, password: string) {
      unwrap(await client.auth.signInWithPassword({ email, password }));
    },

    /** Native Apple / Google sign-in (FR-1.1); Apple needs the raw nonce whose hash it signed. */
    async signInWithIdToken(provider: 'apple' | 'google', token: string, nonce?: string) {
      return unwrap(await client.auth.signInWithIdToken({ provider, token, nonce }));
    },

    async sendMagicLink(email: string) {
      unwrap(
        await client.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: redirectTo, shouldCreateUser: false },
        }),
      );
    },

    async sendPasswordReset(email: string) {
      unwrap(
        await client.auth.resetPasswordForEmail(email, {
          redirectTo: `${redirectTo}?next=reset-password`,
        }),
      );
    },

    /** Completes a magic link, email confirmation or password reset opened in the app. */
    async exchangeCode(code: string) {
      unwrap(await client.auth.exchangeCodeForSession(code));
    },

    async updatePassword(password: string) {
      unwrap(await client.auth.updateUser({ password }));
    },

    /** FR-1.6: deletes the account and personal data, then ends the session. */
    async deleteAccount() {
      unwrap(await client.rpc('delete_account'));
      await client.auth.signOut({ scope: 'local' });
    },

    /** FR-1.4: sign out everywhere, or just this device. */
    async signOut(everywhere = false) {
      if (everywhere) check(await client.rpc('forget_devices'));
      check(await client.auth.signOut({ scope: everywhere ? 'global' : 'local' }));
    },
  };
}

export type AuthRepository = ReturnType<typeof createAuthRepository>;
