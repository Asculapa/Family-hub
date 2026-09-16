import { displayNameSchema, emailSchema, passwordSchema } from '@family-hub/core';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { SocialSignIn } from '@/components/social-sign-in';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { useErrorMessage } from '@/hooks/use-error-message';
import { repos } from '@/lib/supabase';

type Field = 'name' | 'email' | 'password';

export default function SignUpScreen() {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});

  const signUp = useMutation({
    mutationFn: () => repos.auth.signUp(email.trim(), password, name.trim()),
  });

  const submit = () => {
    const next: Partial<Record<Field, string>> = {};
    if (!displayNameSchema.safeParse(name).success) next.name = t('validation.required');
    if (!emailSchema.safeParse(email.trim()).success) next.email = t('validation.email');
    if (!passwordSchema.safeParse(password).success) next.password = t('validation.password');
    setErrors(next);
    if (Object.keys(next).length === 0) signUp.mutate();
  };

  if (signUp.data?.needsConfirmation) {
    return (
      <Screen title={t('auth.signUp.title')}>
        <Notice tone="success" message={t('auth.signUp.checkEmail', { email: email.trim() })} />
        <Link href="/sign-in" replace asChild>
          <Button title={t('auth.forgot.back')} variant="secondary" />
        </Link>
      </Screen>
    );
  }

  return (
    <Screen title={t('auth.signUp.title')} subtitle={t('auth.signUp.subtitle')}>
      <TextField
        label={t('auth.displayName')}
        value={name}
        onChangeText={setName}
        error={errors.name}
        autoComplete="name"
        textContentType="name"
      />
      <TextField
        label={t('auth.email')}
        value={email}
        onChangeText={setEmail}
        error={errors.email}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <TextField
        label={t('auth.password')}
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        onSubmitEditing={submit}
      />
      {signUp.error ? <Notice tone="error" message={errorMessage(signUp.error)!} /> : null}
      <Button title={t('auth.signUp.submit')} loading={signUp.isPending} onPress={submit} />
      <SocialSignIn />
      <Link href="/sign-in" replace asChild>
        <Button title={t('auth.signUp.haveAccount')} variant="link" />
      </Link>
    </Screen>
  );
}
