import { useTranslation } from 'react-i18next';

import { Notice } from '@/components/ui/notice';

import type { FamilyMapProps } from './family-map';

// MapLibre GL or Google Maps JS arrives with the v2 web app (spec section 8).
export function FamilyMap(_props: FamilyMapProps) {
  const { t } = useTranslation();
  return <Notice tone="info" message={t('map.webMap')} />;
}
