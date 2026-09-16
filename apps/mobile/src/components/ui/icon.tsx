import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import type { ColorValue } from 'react-native';

/** SF Symbol on iOS, Material Symbol on Android and web. */
export interface IconName {
  ios: SFSymbol;
  md: AndroidSymbol;
}

export const Icons = {
  add: { ios: 'plus', md: 'add' },
  bell: { ios: 'bell', md: 'notifications' },
  budget: { ios: 'creditcard', md: 'account_balance_wallet' },
  calendar: { ios: 'calendar', md: 'calendar_month' },
  camera: { ios: 'camera', md: 'photo_camera' },
  chat: { ios: 'bubble.left', md: 'chat' },
  check: { ios: 'checkmark', md: 'check' },
  checklist: { ios: 'checklist', md: 'checklist' },
  chevronLeft: { ios: 'chevron.left', md: 'chevron_left' },
  chevronRight: { ios: 'chevron.right', md: 'chevron_right' },
  contacts: { ios: 'person.crop.circle', md: 'contacts' },
  document: { ios: 'doc.text', md: 'description' },
  family: { ios: 'person.2', md: 'group' },
  home: { ios: 'house', md: 'home' },
  homeFill: { ios: 'house.fill', md: 'home' },
  invite: { ios: 'person.badge.plus', md: 'person_add' },
  location: { ios: 'mappin.and.ellipse', md: 'location_on' },
  map: { ios: 'mappin.and.ellipse', md: 'location_on' },
  meal: { ios: 'fork.knife', md: 'restaurant' },
  recipe: { ios: 'book', md: 'menu_book' },
  search: { ios: 'magnifyingglass', md: 'search' },
  shopping: { ios: 'basket', md: 'shopping_basket' },
  sparkles: { ios: 'sparkles', md: 'auto_awesome' },
  trophy: { ios: 'trophy', md: 'emoji_events' },
} as const satisfies Record<string, IconName>;

export function Icon({ name, size = 20, color }: { name: IconName; size?: number; color: ColorValue }) {
  return (
    <SymbolView
      name={{ ios: name.ios, android: name.md, web: name.md }}
      size={size}
      tintColor={color}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}
