import { Icons } from '@/components/ui/icon';

/** Bottom tab bar (FR-9.2). Only Home switches to a filled icon, as in the design. */
export const TABS = [
  { name: 'index', href: '/', label: 'home', icon: Icons.home, activeIcon: Icons.homeFill },
  { name: 'lists', href: '/lists', label: 'lists', icon: Icons.checklist, activeIcon: Icons.checklist },
  { name: 'calendar', href: '/calendar', label: 'calendar', icon: Icons.calendar, activeIcon: Icons.calendar },
  { name: 'map', href: '/map', label: 'map', icon: Icons.map, activeIcon: Icons.map },
  { name: 'family', href: '/family', label: 'family', icon: Icons.family, activeIcon: Icons.family },
] as const;
