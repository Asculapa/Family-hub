import i18next from 'i18next';

import en from './locales/en.json';

export const SUPPORTED_LANGUAGES = ['en'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export const resources = { en: { translation: en } } as const;

/** Initializes the shared i18next instance; pass the device language. */
export function initI18n(language: string) {
  const lng = (SUPPORTED_LANGUAGES as readonly string[]).includes(language) ? language : 'en';
  return i18next.init({
    lng,
    fallbackLng: 'en',
    resources,
    interpolation: { escapeValue: false },
  });
}

export { i18next };
