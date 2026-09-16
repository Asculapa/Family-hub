import { can, invitableRoles, type Role } from '@family-hub/core';
import type { Invite } from '@family-hub/data';
import { useMutation } from '@tanstack/react-query';
import { Link, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, RefreshControl, Share, StyleSheet, View } from 'react-native';

import { ListRow, Section } from '@/components/list-row';
import { ThemedText } from '@/components/themed-text';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, IconTile, TileTones } from '@/components/ui/card';
import { Icons } from '@/components/ui/icon';
import { Notice } from '@/components/ui/notice';
import { Screen } from '@/components/ui/screen';
import { Radius, Spacing } from '@/constants/theme';
import { LATER_FEATURES } from '@/constants/later-features';
import { useFamily, useInvites, useMembers } from '@/hooks/queries';
import { useErrorMessage } from '@/hooks/use-error-message';
import { useFamilyLocations } from '@/hooks/use-locations';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { confirm } from '@/lib/confirm';
import { memberLocationStatus } from '@/lib/member-status';
import { queryClient, queryKeys } from '@/lib/query-client';
import { inviteShareMessage } from '@/lib/share-invite';
import { repos } from '@/lib/supabase';
import { useUserId } from '@/providers/session-provider';

export default function FamilyScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const errorMessage = useErrorMessage();
  const userId = useUserId();
  const { family, role } = useFamily();
  const members = useMembers(family.id);
  const locations = useFamilyLocations();
  const now = useNow();
  const canSeeInvites = role !== 'child';
  const invites = useInvites(family.id, canSeeInvites);

  const onError = (error: unknown) => Alert.alert(errorMessage(error)!);
  const refreshMembership = () => queryClient.invalidateQueries({ queryKey: queryKeys.membership(userId) });

  const revoke = useMutation({
    mutationFn: (invite: Invite) => repos.families.revokeInvite(invite.id),
    onSuccess: () => invites.refetch(),
    onError,
  });
  const leave = useMutation({
    mutationFn: () => repos.families.removeMember(family.id, userId),
    onSuccess: refreshMembership,
    onError,
  });
  const deleteFamily = useMutation({
    mutationFn: () => repos.families.deleteFamily(family.id),
    onSuccess: refreshMembership,
    onError,
  });

  const roleLabel = (r: Role) => t(`roles.${r}`);

  const askRevoke = async (invite: Invite) => {
    const ok = await confirm(
      t('family.revoke'),
      t('family.revokeConfirm', { code: invite.code }),
      t('family.revoke'),
      t('common.cancel'),
    );
    if (ok) revoke.mutate(invite);
  };

  return (
    <Screen
      eyebrow={t('family.eyebrow')}
      title={family.name}
      tabs
      refreshControl={
        <RefreshControl
          refreshing={members.isRefetching || invites.isRefetching}
          onRefresh={() => {
            members.refetch();
            if (canSeeInvites) invites.refetch();
          }}
        />
      }>
      {members.isError ? <Notice tone="error" message={t('common.loadFailed')} /> : null}
      <Card style={styles.members}>
        {members.data?.map((m) => {
          const isMe = m.userId === userId;
          const manageable =
            !isMe && (can(role, 'member.manage') || (m.role === 'child' && can(role, 'location.allowChild')));
          const name = isMe ? `${m.displayName} (${t('family.you')})` : m.displayName;
          const open = isMe
            ? () => router.push('/profile')
            : manageable
              ? () => router.push({ pathname: '/member/[id]', params: { id: m.userId } })
              : undefined;
          return (
            <Pressable
              key={m.userId}
              disabled={!open}
              accessibilityRole={open ? 'button' : undefined}
              accessibilityLabel={`${name}, ${roleLabel(m.role)}`}
              onPress={open}
              style={({ pressed }) => [styles.member, pressed && styles.pressed]}>
              <Avatar name={m.displayName} color={m.color} />
              <View style={styles.flex}>
                <ThemedText style={styles.name}>{name}</ThemedText>
                <ThemedText type="caption" themeColor="textSecondary" numberOfLines={1}>
                  {`${roleLabel(m.role)} · ${memberLocationStatus(locations.data, m.userId, now)}`}
                </ThemedText>
              </View>
              {open ? (
                <View style={[styles.view, { backgroundColor: theme.background }]}>
                  <ThemedText type="caption" themeColor="textSecondary" style={styles.viewText}>
                    {t('family.view')}
                  </ThemedText>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </Card>

      {invitableRoles(role).length > 0 ? (
        <ListRow
          title={t('family.inviteMember')}
          subtitle={t('family.inviteHint')}
          left={<IconTile name={Icons.add} {...TileTones.indigo} />}
          onPress={() => router.push('/invite')}
          chevron={false}
        />
      ) : null}

      {canSeeInvites && invites.data && invites.data.length > 0 ? (
        <Section title={t('family.openInvites')}>
          {invites.data.map((invite) => (
            <ListRow
              key={invite.id}
              title={invite.code}
              subtitle={t('family.inviteRow', {
                role: roleLabel(invite.role),
                uses: invite.uses,
                max: invite.max_uses,
              })}
              right={
                <>
                  <Button
                    title={t('family.share')}
                    variant="link"
                    accessibilityLabel={t('family.shareInvite', { code: invite.code })}
                    onPress={() => Share.share({ message: inviteShareMessage(t, invite) })}
                  />
                  <Button
                    title={t('family.revoke')}
                    variant="link"
                    accessibilityLabel={t('family.revokeInvite', { code: invite.code })}
                    onPress={() => askRevoke(invite)}
                  />
                </>
              }
            />
          ))}
        </Section>
      ) : null}

      <Section title={t('family.comingLater')}>
        <View style={styles.grid}>
          {LATER_FEATURES.map((f) => (
            <Card
              key={f.key}
              onPress={() => router.push({ pathname: '/later/[feature]', params: { feature: f.key } })}
              accessibilityLabel={t(`later.features.${f.key}.title`)}
              style={styles.tile}>
              <IconTile name={f.icon} {...TileTones[f.tone]} size={36} iconSize={16} />
              <ThemedText type="caption" style={styles.tileText} numberOfLines={1}>
                {t(`later.features.${f.key}.title`)}
              </ThemedText>
            </Card>
          ))}
        </View>
      </Section>

      <Section title={t('family.account')}>
        <Link href="/settings" asChild>
          <Button title={t('settings.open')} variant="secondary" />
        </Link>
        <Button
          title={t('family.leave')}
          variant="danger"
          loading={leave.isPending}
          onPress={async () => {
            const ok = await confirm(
              t('family.leave'),
              t('family.leaveConfirm', { family: family.name }),
              t('family.leave'),
              t('common.cancel'),
            );
            if (ok) leave.mutate();
          }}
        />
        {can(role, 'family.delete') ? (
          <Button
            title={t('family.delete')}
            variant="danger"
            loading={deleteFamily.isPending}
            onPress={async () => {
              const ok = await confirm(
                t('family.delete'),
                t('family.deleteConfirm', { family: family.name }),
                t('family.delete'),
                t('common.cancel'),
              );
              if (ok) deleteFamily.mutate();
            }}
          />
        ) : null}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  members: { padding: Spacing.three, gap: Spacing.three },
  member: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - 4,
  },
  pressed: { opacity: 0.7 },
  name: { fontSize: 14, lineHeight: 20, fontWeight: 600 },
  view: { paddingHorizontal: Spacing.three - 4, paddingVertical: Spacing.two, borderRadius: Radius.control },
  viewText: { fontWeight: 500 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two + 2 },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - 4,
    padding: Spacing.three - 4,
  },
  tileText: { flex: 1, fontWeight: 600 },
});
