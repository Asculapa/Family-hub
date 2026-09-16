import type { SFSymbol } from 'sf-symbols-typescript';

/** Bottom tab bar (FR-9.2). */
export const TABS = [
  { name: 'index', href: '/', label: 'home', sf: 'house', md: 'home' },
  { name: 'lists', href: '/lists', label: 'lists', sf: 'checklist', md: 'checklist' },
  { name: 'calendar', href: '/calendar', label: 'calendar', sf: 'calendar', md: 'calendar_month' },
  { name: 'map', href: '/map', label: 'map', sf: 'map', md: 'map' },
  { name: 'family', href: '/family', label: 'family', sf: 'person.3', md: 'group' },
] as const satisfies readonly {
  name: string;
  href: string;
  label: string;
  sf: SFSymbol;
  md: string;
}[];
