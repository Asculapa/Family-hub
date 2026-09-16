import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { useFamily } from '@/hooks/queries';
import { useErrorMessage } from '@/hooks/use-error-message';
import { checkIn } from '@/lib/location';
import { closeScreen } from '@/lib/navigation';
import { queryClient, queryKeys } from '@/lib/query-client';

/** Manual check-in with an optional note (FR-6.6). */
export default function CheckInScreen() {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const { family } = useFamily();
  const [note, setNote] = useState('');

  const send = useMutation({
    mutationFn: () => checkIn(note.trim() || null),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.locations(family.id) });
      closeScreen();
    },
  });

  return (
    <Screen modal>
      <TextField
        label={t('location.checkInNote')}
        placeholder={t('location.checkInPlaceholder')}
        value={note}
        onChangeText={setNote}
        maxLength={100}
        autoFocus
        onSubmitEditing={() => send.mutate()}
      />
      {send.error ? <Notice tone="error" message={errorMessage(send.error)!} /> : null}
      <Button title={t('location.checkIn')} loading={send.isPending} onPress={() => send.mutate()} />
    </Screen>
  );
}
