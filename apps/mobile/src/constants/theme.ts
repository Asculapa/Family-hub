/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#0F172A',
    background: '#F8F9FC',
    /** Cards and sheets that sit on the background. */
    card: '#FFFFFF',
    cardBorder: '#EEF1F6',
    /** Inputs, tracks and other recessed surfaces. */
    backgroundElement: '#F1F4F9',
    backgroundSelected: '#E2E8F0',
    textSecondary: '#64748B',
    textMuted: '#94A3B8',
    border: '#E2E8F0',
    primary: '#4F46E5',
    primarySoft: '#EEF2FF',
    onPrimary: '#FFFFFF',
    link: '#4F46E5',
    danger: '#DC2626',
    dangerSoft: '#FEF2F2',
    success: '#059669',
    successSoft: '#ECFDF5',
    warning: '#D97706',
    shadow: '#0F172A',
  },
  dark: {
    text: '#F8FAFC',
    background: '#0B0E17',
    card: '#151A26',
    cardBorder: '#1F2636',
    backgroundElement: '#1C2230',
    backgroundSelected: '#2A3244',
    textSecondary: '#94A3B8',
    textMuted: '#64748B',
    border: '#2A3244',
    primary: '#4F46E5',
    primarySoft: '#1E1B4B',
    onPrimary: '#FFFFFF',
    link: '#A5B4FC',
    danger: '#F87171',
    dangerSoft: '#2A1215',
    success: '#34D399',
    successSoft: '#052E22',
    warning: '#FBBF24',
    shadow: '#000000',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  control: 12,
  card: 16,
  hero: 22,
  pill: 999,
} as const;

export const MaxContentWidth = 800;
