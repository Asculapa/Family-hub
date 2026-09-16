import { can, itemTitleSchema, quantityInputSchema } from '@family-hub/core';
import type { ListItemRow } from '@family-hub/data';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { closeScreen } from '@/lib/navigation';
import { Chips } from '@/components/ui/chips';
import { Notice } from '@/components/ui/notice';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { useFamily, useMembers } from '@/hooks/queries';
import { useCategories, useItem, useList } from '@/hooks/use-lists';
import { confirm } from '@/lib/confirm';
import { endOfDay, formatDay } from '@/lib/format';
import { useSync } from '@/providers/sync-provider';

export default function ItemScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const item = useItem(id);

  if (!item || item.deleted_at) {
    return (
      <Screen modal>
        <Notice tone="info" message={t('lists.item.notFound')} />
      </Screen>
    );
  }
  return <ItemForm item={item} />;
}

const DUE_PRESETS = [
  { key: 'dueToday', days: 0 },
  { key: 'dueTomorrow', days: 1 },
  { key: 'dueNextWeek', days: 7 },
] as const;

function ItemForm({ item }: { item: ListItemRow }) {
  const { t } = useTranslation();
  const { family, role } = useFamily();
  const { actions } = useSync();
  const list = useList(item.list_id);
  const categories = useCategories();
  const members = useMembers(family.id);
  const shopping = list?.type !== 'todo';

  const [title, setTitle] = useState(item.title);
  const [quantity, setQuantity] = useState(item.quantity === null ? '' : String(item.quantity));
  const [unit, setUnit] = useState(item.unit ?? '');
  const [categoryId, setCategoryId] = useState(item.category_id);
  const [note, setNote] = useState(item.note ?? '');
  const [assigneeId, setAssigneeId] = useState(item.assignee_id);
  const [dueAt, setDueAt] = useState(item.due_at);
  const [errors, setErrors] = useState<{ title?: string; quantity?: string }>({});

  // Presets are compared by calendar day; a date set elsewhere shows as its own chip.
  const dueOptions = [
    { value: null, label: t('lists.item.dueNone') },
    ...DUE_PRESETS.map((p) => ({ value: endOfDay(p.days), label: t(`lists.item.${p.key}`) })),
  ];
  const sameDay = (a: string, b: string) => new Date(a).toDateString() === new Date(b).toDateString();
  const preset = dueAt ? dueOptions.find((o) => o.value && sameDay(o.value, dueAt)) : undefined;
  if (dueAt && !preset) dueOptions.push({ value: dueAt, label: formatDay(dueAt) });
  const dueValue = preset ? preset.value : dueAt;

  const save = async () => {
    const parsedTitle = itemTitleSchema.safeParse(title);
    const parsedQuantity = quantityInputSchema.safeParse(quantity);
    const next = {
      title: parsedTitle.success ? undefined : t('validation.required'),
      quantity: parsedQuantity.success ? undefined : t('lists.item.invalidQuantity'),
    };
    setErrors(next);
    if (!parsedTitle.success || !parsedQuantity.success) return;

    await actions.updateItem(item.id, {
      title: parsedTitle.data,
      quantity: parsedQuantity.data,
      unit: unit.trim() || null,
      category_id: categoryId,
      note: note.trim() || null,
      assignee_id: assigneeId,
      due_at: dueAt,
    });
    closeScreen();
  };

  return (
    <Screen modal>
      <TextField label={t('lists.item.name')} value={title} onChangeText={setTitle} error={errors.title} maxLength={200} />
      {shopping ? (
        <>
          <TextField
            label={t('lists.item.quantity')}
            value={quantity}
            onChangeText={setQuantity}
            error={errors.quantity}
            keyboardType="decimal-pad"
          />
          <TextField
            label={t('lists.item.unit')}
            placeholder={t('lists.item.unitPlaceholder')}
            value={unit}
            onChangeText={setUnit}
            maxLength={20}
            autoCapitalize="none"
          />
          <Chips
            label={t('lists.item.category')}
            value={categoryId}
            onChange={setCategoryId}
            options={[
              { value: null, label: t('lists.uncategorized') },
              ...categories.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
        </>
      ) : (
        <>
          <Chips
            label={t('lists.item.assignee')}
            value={assigneeId}
            onChange={setAssigneeId}
            options={[
              { value: null, label: t('lists.item.nobody') },
              ...(members.data ?? []).map((m) => ({ value: m.userId, label: m.displayName })),
            ]}
          />
          <Chips label={t('lists.item.due')} value={dueValue} onChange={setDueAt} options={dueOptions} />
        </>
      )}
      <TextField
        label={t('lists.item.note')}
        value={note}
        onChangeText={setNote}
        multiline
        maxLength={1000}
        style={{ minHeight: 88, paddingTop: 12, textAlignVertical: 'top' }}
      />
      <Button title={t('common.save')} onPress={save} />
      {can(role, 'item.delete') ? (
        <Button
          title={t('lists.row.delete')}
          variant="danger"
          onPress={async () => {
            const ok = await confirm(t('lists.row.delete'), item.title, t('lists.row.delete'), t('common.cancel'));
            if (!ok) return;
            await actions.deleteItem(item.id);
            closeScreen();
          }}
        />
      ) : null}
    </Screen>
  );
}
