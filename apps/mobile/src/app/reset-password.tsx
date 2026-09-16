import { passwordSchema } from '@family-hub/core';
import { useMutation } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { useErrorMessage } from '@/hooks/use-error-message';
import { repos } from '@/lib/supabase';

export default function ResetPasswordScreen() {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const update = useMutation({
    mutationFn: () => repos.auth.updatePassword(password),
    onSuccess: () => router.replace('/'),
  });

  const submit = () => {
    const ok = passwordSchema.safeParse(password).success;
    setError(ok ? null : t('validation.password'));
    if (ok) update.mutate();
  };

  return (
    <Screen title={t('auth.reset.title')}>
      <TextField
        label={t('auth.newPassword')}
        value={password}
        onChangeText={setPassword}
        error={error}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        onSubmitEditing={submit}
      />
      {update.error ? <Notice tone="error" message={errorMessage(update.error)!} /> : null}
      <Button title={t('auth.reset.submit')} loading={update.isPending} onPress={submit} />
    </Screen>
  );
}
