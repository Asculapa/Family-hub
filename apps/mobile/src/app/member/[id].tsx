import { can, ROLES } from '@family-hub/core';
import { useMutation } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { closeScreen } from '@/lib/navigation';
import { Notice } from '@/components/ui/notice';
import { Screen } from '@/components/ui/screen';
import { useFamily, useMembers } from '@/hooks/queries';
import { useFamilyLocations } from '@/hooks/use-locations';
import { useErrorMessage } from '@/hooks/use-error-message';
import { confirm } from '@/lib/confirm';
import { queryClient, queryKeys } from '@/lib/query-client';
import { repos } from '@/lib/supabase';

/** Owner actions for another member (FR-2.5); adults can allow a child's location sharing (FR-6.1). */
export default function MemberScreen() {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { family, role } = useFamily();
  const members = useMembers(family.id);
  const locations = useFamilyLocations();
  const allowed = !!locations.data?.settings.find((s) => s.user_id === id)?.allowed_by;
  const member = members.data?.find((m) => m.userId === id);

  const done = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.members(family.id) });
    closeScreen();
  };
  const setRole = useMutation({
    mutationFn: (role: (typeof ROLES)[number]) => repos.families.setRole(family.id, id, role),
    onSuccess: done,
  });
  const remove = useMutation({
    mutationFn: () => repos.families.removeMember(family.id, id),
    onSuccess: done,
  });
  const allow = useMutation({
    mutationFn: (on: boolean) => repos.location.allowChild(id, on),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.locations(family.id) }),
  });

  if (!member) return <Screen modal>{null}</Screen>;

  const error = setRole.error ?? remove.error ?? allow.error;
  const manage = can(role, 'member.manage');

  return (
    <Screen modal title={member.displayName} subtitle={t(`roles.${member.role}`)}>
      {member.role === 'child' && can(role, 'location.allowChild') ? (
        <Button
          title={allowed ? t('location.disallow') : t('location.allow')}
          variant="secondary"
          loading={allow.isPending}
          onPress={() => allow.mutate(!allowed)}
        />
      ) : null}
      {!manage ? null : ROLES.filter((r) => r !== member.role).map((r) => (
        <Button
          key={r}
          title={t('family.makeRole', { role: t(`roles.${r}`) })}
          variant="secondary"
          loading={setRole.isPending && setRole.variables === r}
          onPress={() => setRole.mutate(r)}
        />
      ))}
      {manage ? (
      <Button
        title={t('family.remove')}
        variant="danger"
        loading={remove.isPending}
        onPress={async () => {
          const ok = await confirm(
            t('family.remove'),
            t('family.removeConfirm', { name: member.displayName }),
            t('family.remove'),
            t('common.cancel'),
          );
          if (ok) remove.mutate();
        }}
      />
      ) : null}
      {error ? <Notice tone="error" message={errorMessage(error)!} /> : null}
    </Screen>
  );
}
