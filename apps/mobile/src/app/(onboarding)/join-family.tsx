import { inviteCodeSchema, type AcceptInviteResult } from '@family-hub/core';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { useErrorMessage } from '@/hooks/use-error-message';
import { pendingInvite } from '@/lib/pending-invite';
import { queryClient, queryKeys } from '@/lib/query-client';
import { repos } from '@/lib/supabase';
import { useUserId } from '@/providers/session-provider';

export default function JoinFamilyScreen() {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const userId = useUserId();
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);

  const join = useMutation({
    mutationFn: (invite: { code: string } | { token: string }) => repos.families.acceptInvite(invite),
    onSuccess: async (result: AcceptInviteResult, invite) => {
      if ('token' in invite) await pendingInvite.clear();
      if (result.status === 'joined') {
        await queryClient.invalidateQueries({ queryKey: queryKeys.membership(userId) });
      }
    },
  });

  // An invite link opened earlier (FR-2.4) is applied automatically.
  const { mutate } = join;
  useEffect(() => {
    pendingInvite.get().then((token) => token && mutate({ token }));
  }, [mutate]);

  const submit = () => {
    const ok = inviteCodeSchema.safeParse(code).success;
    setCodeError(ok ? null : t('validation.code'));
    if (ok) join.mutate({ code });
  };

  const status = join.data?.status;

  return (
    <Screen title={t('onboarding.join.title')} subtitle={t('onboarding.join.subtitle')}>
      <TextField
        label={t('onboarding.join.code')}
        value={code}
        onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
        error={codeError}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={6}
        onSubmitEditing={submit}
      />
      {status && status !== 'joined' ? (
        <Notice tone="error" message={t(`invite.result.${status}`)} />
      ) : null}
      {join.error ? <Notice tone="error" message={errorMessage(join.error)!} /> : null}
      <Button title={t('onboarding.join.submit')} loading={join.isPending} onPress={submit} />
    </Screen>
  );
}
