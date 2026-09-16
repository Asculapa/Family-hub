import { emailSchema } from '@family-hub/core';
import { useMutation } from '@tanstack/react-query';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { closeScreen } from '@/lib/navigation';
import { Notice } from '@/components/ui/notice';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { useErrorMessage } from '@/hooks/use-error-message';
import { repos } from '@/lib/supabase';

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);

  const send = useMutation({ mutationFn: () => repos.auth.sendPasswordReset(email.trim()) });

  const submit = () => {
    const ok = emailSchema.safeParse(email.trim()).success;
    setEmailError(ok ? null : t('validation.email'));
    if (ok) send.mutate();
  };

  return (
    <Screen title={t('auth.forgot.title')} subtitle={t('auth.forgot.subtitle')}>
      <TextField
        label={t('auth.email')}
        value={email}
        onChangeText={setEmail}
        error={emailError}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        onSubmitEditing={submit}
      />
      {send.error ? <Notice tone="error" message={errorMessage(send.error)!} /> : null}
      {send.isSuccess ? (
        <Notice tone="success" message={t('auth.forgot.sent', { email: email.trim() })} />
      ) : null}
      <Button title={t('auth.forgot.submit')} loading={send.isPending} onPress={submit} />
      <Button title={t('auth.forgot.back')} variant="link" onPress={() => closeScreen()} />
    </Screen>
  );
}
