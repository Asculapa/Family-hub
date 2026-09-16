import { router } from 'expo-router';

/** Closes a modal; falls back to Home when it was opened directly, e.g. from a link. */
export function closeScreen() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
