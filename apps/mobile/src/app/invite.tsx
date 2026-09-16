import { invitableRoles, INVITE_MAX_USES } from '@family-hub/core';
import { useMutation } from '@tanstack/react-query';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Share, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { closeScreen } from '@/lib/navigation';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { Spacing } from '@/constants/theme';
import { useFamily } from '@/hooks/queries';
import { useErrorMessage } from '@/hooks/use-error-message';
import { queryClient, queryKeys } from '@/lib/query-client';
import { inviteShareMessage } from '@/lib/share-invite';
import { repos } from '@/lib/supabase';

export default function InviteScreen() {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const { family, role } = useFamily();
  const roles = invitableRoles(role);
  const [inviteRole, setInviteRole] = useState(roles[roles.length - 1] ?? 'child');
  const [multi, setMulti] = useState(false);

  const create = useMutation({
    mutationFn: () => repos.families.createInvite(family.id, inviteRole, multi ? INVITE_MAX_USES : 1),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.invites(family.id) }),
  });

  const invite = create.data;

  if (invite) {
    return (
      <Screen modal>
        <View style={styles.codeBox}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            {t('invite.create.code')}
          </ThemedText>
          <ThemedText
            type="title"
            style={styles.code}
            selectable
            accessibilityLabel={invite.code.split('').join(' ')}>
            {invite.code}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t(`roles.${invite.role}`)} · {t('invite.create.expires')}
          </ThemedText>
        </View>
        <Button
          title={t('invite.create.share')}
          onPress={() => Share.share({ message: inviteShareMessage(t, invite) })}
        />
        <Button title={t('invite.create.done')} variant="secondary" onPress={() => closeScreen()} />
      </Screen>
    );
  }

  return (
    <Screen modal>
      <ThemedText type="smallBold">{t('invite.create.role')}</ThemedText>
      <Segmented
        options={roles.map((r) => ({ value: r, label: t(`roles.${r}`) }))}
        value={inviteRole}
        onChange={setInviteRole}
      />
      <ThemedText type="smallBold">{t('invite.create.uses')}</ThemedText>
      <Segmented
        options={[
          { value: 'single', label: t('invite.create.single') },
          { value: 'multi', label: t('invite.create.multi') },
        ]}
        value={multi ? 'multi' : 'single'}
        onChange={(v) => setMulti(v === 'multi')}
      />
      {create.error ? <Notice tone="error" message={errorMessage(create.error)!} /> : null}
      <Button title={t('invite.create.submit')} loading={create.isPending} onPress={() => create.mutate()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  codeBox: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.four,
  },
  code: {
    letterSpacing: 8,
    fontVariant: ['tabular-nums'],
  },
});
