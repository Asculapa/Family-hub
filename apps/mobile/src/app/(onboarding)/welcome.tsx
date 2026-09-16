import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { signOut } from '@/lib/sign-out';

export default function WelcomeScreen() {
  const { t } = useTranslation();

  return (
    <Screen title={t('onboarding.welcome.title')} subtitle={t('onboarding.welcome.subtitle')}>
      <Link href="/create-family" asChild>
        <Button title={t('onboarding.welcome.create')} />
      </Link>
      <Link href="/join-family" asChild>
        <Button title={t('onboarding.welcome.join')} variant="secondary" />
      </Link>
      <Button title={t('auth.signOut')} variant="link" onPress={() => signOut()} />
    </Screen>
  );
}
