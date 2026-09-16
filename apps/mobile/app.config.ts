import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * app.json plus values that differ per developer or environment:
 * - EAS_PROJECT_ID: from `eas init`; required for push tokens.
 * - GOOGLE_IOS_URL_SCHEME: reversed iOS client id, enables Google sign-in on iOS.
 * - GOOGLE_MAPS_ANDROID_API_KEY: Google Maps on Android (iOS uses Apple Maps).
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const googleScheme = process.env.GOOGLE_IOS_URL_SCHEME;
  const mapsKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;

  return {
    ...config,
    name: config.name ?? 'Family Hub',
    slug: config.slug ?? 'family-hub',
    plugins: [
      ...(config.plugins ?? []),
      ...(googleScheme ? [['@react-native-google-signin/google-signin', { iosUrlScheme: googleScheme }] as [string, unknown]] : []),
      ...(mapsKey ? [['react-native-maps', { androidGoogleMapsApiKey: mapsKey }] as [string, unknown]] : []),
    ],
    extra: {
      ...config.extra,
      eas: { projectId: process.env.EAS_PROJECT_ID ?? config.extra?.eas?.projectId },
    },
  };
};
