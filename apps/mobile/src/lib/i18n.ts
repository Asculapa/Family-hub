import { initI18n, i18next } from '@family-hub/i18n';
import { getLocales } from 'expo-localization';
import { initReactI18next } from 'react-i18next';

i18next.use(initReactI18next);

export const i18nReady = initI18n(getLocales()[0]?.languageCode ?? 'en');
