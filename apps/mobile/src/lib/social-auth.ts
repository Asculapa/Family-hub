import * as AppleAuthentication from 'expo-apple-authentication';
import { CryptoDigestAlgorithm, digestStringAsync, randomUUID } from 'expo-crypto';
import { Platform } from 'react-native';

import { repos } from './supabase';

/** Shown when the backend has the provider configured (see supabase/config.toml). */
export const appleEnabled = Platform.OS === 'ios' && process.env.EXPO_PUBLIC_APPLE_SIGN_IN === '1';
export const googleEnabled = !!process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

export class SignInCancelled extends Error {}

export async function signInWithApple() {
  const rawNonce = randomUUID();
  const hashed = await digestStringAsync(CryptoDigestAlgorithm.SHA256, rawNonce);
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashed,
    });
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') throw new SignInCancelled();
    throw e;
  }
  if (!credential.identityToken) throw new Error('Apple returned no identity token');
  const { user } = await repos.auth.signInWithIdToken('apple', credential.identityToken, rawNonce);
  // Apple shares the name only on the first sign-in.
  const name = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(' ');
  if (name && user) await repos.profiles.update(user.id, { display_name: name }).catch(() => {});
}

export async function signInWithGoogle() {
  // Loaded lazily: the native module is absent in Expo Go.
  const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  });
  await GoogleSignin.hasPlayServices();
  const result = await GoogleSignin.signIn();
  if (result.type !== 'success') throw new SignInCancelled();
  if (!result.data.idToken) throw new Error('Google returned no id token');
  await repos.auth.signInWithIdToken('google', result.data.idToken);
}
