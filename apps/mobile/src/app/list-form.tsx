import { listNameSchema } from '@family-hub/core';
import type { ListRow } from '@family-hub/data';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { closeScreen } from '@/lib/navigation';
import { Screen } from '@/components/ui/screen';
import { Segmented } from '@/components/ui/segmented';
import { TextField } from '@/components/ui/text-field';
import { useList } from '@/hooks/use-lists';
import { confirm } from '@/lib/confirm';
import { useSync } from '@/providers/sync-provider';

/** Create a list, or rename/archive one when `id` is given (FR-3.1). */
export default function ListFormScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { actions } = useSync();
  const existing = useList(id ?? '');
  const [name, setName] = useState(existing?.name ?? '');
  const [type, setType] = useState<ListRow['type']>(existing?.type ?? 'shopping');
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const parsed = listNameSchema.safeParse(name);
    setError(parsed.success ? null : t('validation.required'));
    if (!parsed.success) return;
    if (existing) {
      await actions.renameList(existing.id, parsed.data);
      closeScreen();
    } else {
      const list = await actions.createList(parsed.data, type);
      router.replace({ pathname: '/lists/[id]', params: { id: list.id } });
    }
  };

  return (
    <Screen modal>
      <Stack.Screen options={{ title: existing ? t('lists.form.editTitle') : t('lists.form.newTitle') }} />
      <TextField
        label={t('lists.form.name')}
        placeholder={t('lists.form.namePlaceholder')}
        value={name}
        onChangeText={setName}
        error={error}
        maxLength={60}
        autoFocus={!existing}
        onSubmitEditing={save}
      />
      {existing ? null : (
        <Segmented
          options={[
            { value: 'shopping', label: t('lists.form.shopping') },
            { value: 'todo', label: t('lists.form.todo') },
          ]}
          value={type}
          onChange={setType}
        />
      )}
      <Button title={existing ? t('common.save') : t('lists.form.create')} onPress={save} />
      {existing ? (
        <Button
          title={t('lists.form.archive')}
          variant="danger"
          onPress={async () => {
            const ok = await confirm(
              t('lists.form.archive'),
              t('lists.form.archiveConfirm', { name: existing.name }),
              t('lists.form.archive'),
              t('common.cancel'),
            );
            if (!ok) return;
            await actions.archiveList(existing.id);
            router.dismissTo('/lists');
          }}
        />
      ) : null}
    </Screen>
  );
}
