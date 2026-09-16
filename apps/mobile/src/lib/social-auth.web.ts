import { authRedirectUrl, supabase } from './supabase';

// Web uses OAuth redirects (spec section 8), completed by /auth/callback.
export const appleEnabled = process.env.EXPO_PUBLIC_APPLE_SIGN_IN === '1';
export const googleEnabled = !!process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

export class SignInCancelled extends Error {}

export async function signInWithApple() {
  await supabase.auth.signInWithOAuth({ provider: 'apple', options: { redirectTo: authRedirectUrl } });
}

export async function signInWithGoogle() {
  await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: authRedirectUrl } });
}
