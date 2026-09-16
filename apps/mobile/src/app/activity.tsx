import { useTranslation } from 'react-i18next';
import { RefreshControl } from 'react-native';

import { ActivityRow } from '@/components/activity-row';
import { ThemedText } from '@/components/themed-text';
import { Notice } from '@/components/ui/notice';
import { Screen } from '@/components/ui/screen';
import { useFamily, useMembers } from '@/hooks/queries';
import { useActivity } from '@/hooks/use-activity';
import { useNow } from '@/hooks/use-now';

/** Last 30 days of family activity (FR-8.1). */
export default function ActivityScreen() {
  const { t } = useTranslation();
  const { family } = useFamily();
  const members = useMembers(family.id);
  const activity = useActivity();
  const now = useNow();
  const byId = new Map((members.data ?? []).map((m) => [m.userId, m]));

  return (
    <Screen
      modal
      refreshControl={<RefreshControl refreshing={activity.isRefetching} onRefresh={() => activity.refetch()} />}>
      {activity.isError ? <Notice tone="error" message={t('common.loadFailed')} /> : null}
      {activity.data?.length === 0 ? <ThemedText themeColor="textSecondary">{t('activity.empty')}</ThemedText> : null}
      {activity.data?.map((entry) => {
        const actor = entry.actor_id ? byId.get(entry.actor_id) : undefined;
        return (
          <ActivityRow
            key={entry.id}
            entry={entry}
            actorName={actor?.displayName}
            actorColor={actor?.color ?? null}
            now={now}
          />
        );
      })}
    </Screen>
  );
}
