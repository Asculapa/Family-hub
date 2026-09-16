import { emailSchema } from '@family-hub/core';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { SocialSignIn } from '@/components/social-sign-in';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { useErrorMessage } from '@/hooks/use-error-message';
import { pendingInvite } from '@/lib/pending-invite';
import { repos } from '@/lib/supabase';

export default function SignInScreen() {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [hasInvite, setHasInvite] = useState(false);

  useEffect(() => {
    pendingInvite.get().then((token) => setHasInvite(!!token));
  }, []);

  const signIn = useMutation({ mutationFn: () => repos.auth.signIn(email.trim(), password) });
  const magicLink = useMutation({ mutationFn: () => repos.auth.sendMagicLink(email.trim()) });

  const validEmail = () => {
    const ok = emailSchema.safeParse(email.trim()).success;
    setEmailError(ok ? null : t('validation.email'));
    return ok;
  };

  const error = signIn.error ?? magicLink.error;

  return (
    <Screen title={t('auth.signIn.title')} subtitle={t('auth.signIn.subtitle')}>
      {hasInvite ? <Notice tone="info" message={t('auth.signIn.pendingInvite')} /> : null}
      <TextField
        label={t('auth.email')}
        value={email}
        onChangeText={setEmail}
        error={emailError}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <TextField
        label={t('auth.password')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        onSubmitEditing={() => validEmail() && signIn.mutate()}
      />
      {error ? <Notice tone="error" message={errorMessage(error)!} /> : null}
      {magicLink.isSuccess ? (
        <Notice tone="success" message={t('auth.signIn.magicLinkSent', { email: email.trim() })} />
      ) : null}
      <Button
        title={t('auth.signIn.submit')}
        loading={signIn.isPending}
        disabled={!password}
        onPress={() => validEmail() && signIn.mutate()}
      />
      <Button
        title={t('auth.signIn.magicLink')}
        variant="secondary"
        loading={magicLink.isPending}
        onPress={() => validEmail() && magicLink.mutate()}
      />
      <SocialSignIn />
      <Link href="/forgot-password" asChild>
        <Button title={t('auth.signIn.forgot')} variant="link" />
      </Link>
      <Link href="/sign-up" replace asChild>
        <Button title={t('auth.signIn.noAccount')} variant="link" />
      </Link>
    </Screen>
  );
}
