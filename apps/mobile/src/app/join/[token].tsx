import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { Screen } from '@/components/ui/screen';
import { useMembership } from '@/hooks/queries';
import { pendingInvite } from '@/lib/pending-invite';
import { useSession } from '@/providers/session-provider';

/**
 * Invite link target: familyhub.app/join/<token> (FR-2.4). The token is kept
 * until the user is signed in, then applied on the join screen.
 */
export default function InviteLinkScreen() {
  const { t } = useTranslation();
  const { token } = useLocalSearchParams<{ token: string }>();
  const { session } = useSession();
  const membership = useMembership();
  const [saved, setSaved] = useState(false);

  const hasFamily = !!membership.data;

  useEffect(() => {
    if (hasFamily || !token) return;
    pendingInvite.set(token).then(() => setSaved(true));
  }, [token, hasFamily]);

  if (hasFamily) {
    return (
      <Screen title={t('invite.link.title')}>
        <Notice tone="info" message={t('invite.link.alreadyInFamily')} />
        <Button title={t('invite.link.goHome')} onPress={() => router.replace('/')} />
      </Screen>
    );
  }

  if (!saved) return null;
  return <Redirect href={session ? '/join-family' : '/sign-in'} />;
}
