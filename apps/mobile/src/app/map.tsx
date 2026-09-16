import { useTranslation } from 'react-i18next';

import { PlaceholderScreen } from '@/components/placeholder-screen';

export default function MapScreen() {
  const { t } = useTranslation();
  return <PlaceholderScreen title={t('map.title')} />;
}
