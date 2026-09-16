import type { TileTones } from '@/components/ui/card';
import { Icons, type IconName } from '@/components/ui/icon';

/** Features planned after the MVP, previewed from the Family tab (spec sections 12–13). */
export const LATER_FEATURES = [
  { key: 'meal', icon: Icons.meal, tone: 'orange' },
  { key: 'recipes', icon: Icons.recipe, tone: 'amber' },
  { key: 'documents', icon: Icons.document, tone: 'sky' },
  { key: 'contacts', icon: Icons.contacts, tone: 'cyan' },
  { key: 'chat', icon: Icons.chat, tone: 'violet' },
  { key: 'photos', icon: Icons.camera, tone: 'pink' },
  { key: 'budget', icon: Icons.budget, tone: 'emerald' },
] as const satisfies readonly { key: string; icon: IconName; tone: keyof typeof TileTones }[];

export type LaterFeature = (typeof LATER_FEATURES)[number]['key'];
