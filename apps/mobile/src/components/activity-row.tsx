import type { ActivityRow as Activity, ActivitySummary } from '@family-hub/data';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ListRow } from '@/components/list-row';
import { Avatar } from '@/components/ui/avatar';
import { timeAgo } from '@/lib/format';

interface ActivityRowProps {
  entry: Activity;
  actorName: string | undefined;
  actorColor: string | null;
  now: number;
}

/** One activity entry; links to the item's list or the event (FR-8.2). */
export function ActivityRow({ entry, actorName, actorColor, now }: ActivityRowProps) {
  const { t } = useTranslation();
  const s = entry.summary as ActivitySummary;
  const actor = actorName ?? (entry.actor_id ? t('activity.someone') : t('activity.formerMember'));

  const text = (() => {
    switch (entry.verb) {
      case 'item_added':
        return t('activity.item_added', { actor, title: s.title, list: s.list_name });
      case 'item_done':
        return t(s.list_type === 'todo' ? 'activity.item_done_todo' : 'activity.item_done_shopping', { actor, title: s.title });
      case 'event_created':
      case 'event_changed':
        return t(`activity.${entry.verb}`, { actor, title: s.title });
      case 'checked_in':
        return s.note ? t('activity.checked_in_note', { actor, note: s.note }) : t('activity.checked_in', { actor });
      default:
        return t('activity.member_joined', { actor });
    }
  })();

  const open = (() => {
    if (entry.entity_type === 'list_item' && s.list_id) {
      return () => router.push({ pathname: '/lists/[id]', params: { id: s.list_id! } });
    }
    if (entry.entity_type === 'event' && entry.entity_id) {
      return () => router.push({ pathname: '/event-form', params: { id: entry.entity_id! } });
    }
    if (entry.entity_type === 'check_in') return () => router.push('/map');
    return undefined;
  })();

  return (
    <ListRow
      title={text}
      subtitle={timeAgo(entry.created_at, now)}
      left={<Avatar name={actor} color={actorColor} size={32} />}
      onPress={open}
    />
  );
}
