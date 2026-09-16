import { familyNameSchema } from '@family-hub/core';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { useErrorMessage } from '@/hooks/use-error-message';
import { queryClient, queryKeys } from '@/lib/query-client';
import { repos } from '@/lib/supabase';
import { useUserId } from '@/providers/session-provider';

export default function CreateFamilyScreen() {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const userId = useUserId();
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);

  // Refetching the membership flips the root guard to the tabs.
  const create = useMutation({
    mutationFn: () => repos.families.create(name.trim()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.membership(userId) }),
  });

  const submit = () => {
    const ok = familyNameSchema.safeParse(name).success;
    setNameError(ok ? null : t('validation.required'));
    if (ok) create.mutate();
  };

  return (
    <Screen title={t('onboarding.create.title')}>
      <TextField
        label={t('onboarding.create.name')}
        placeholder={t('onboarding.create.placeholder')}
        value={name}
        onChangeText={setName}
        error={nameError}
        autoFocus
        maxLength={80}
        onSubmitEditing={submit}
      />
      {create.error ? <Notice tone="error" message={errorMessage(create.error)!} /> : null}
      <Button title={t('onboarding.create.submit')} loading={create.isPending} onPress={submit} />
    </Screen>
  );
}
