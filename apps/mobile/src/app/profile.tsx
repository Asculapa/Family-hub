import { displayNameSchema } from '@family-hub/core';
import { MEMBER_COLORS } from '@family-hub/ui';
import { useMutation } from '@tanstack/react-query';

import type { Profile } from '@family-hub/data';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { closeScreen } from '@/lib/navigation';
import { Button } from '@/components/ui/button';
import { DateTimeField } from '@/components/ui/date-time-field';
import { Notice } from '@/components/ui/notice';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useFamily, useProfile } from '@/hooks/queries';
import { useErrorMessage } from '@/hooks/use-error-message';
import { useTheme } from '@/hooks/use-theme';
import { queryClient, queryKeys } from '@/lib/query-client';
import { repos } from '@/lib/supabase';
import { useUserId } from '@/providers/session-provider';

export default function ProfileScreen() {
  const { t } = useTranslation();
  const profile = useProfile();

  if (profile.isError) {
    return (
      <Screen modal>
        <Notice tone="error" message={t('common.loadFailed')} />
      </Screen>
    );
  }
  if (!profile.data) return <Screen modal>{null}</Screen>;
  return <ProfileForm profile={profile.data} />;
}

function ProfileForm({ profile }: { profile: Profile }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const errorMessage = useErrorMessage();
  const userId = useUserId();
  const { family } = useFamily();
  const [name, setName] = useState(profile.display_name);
  const [color, setColor] = useState(profile.color);
  const [birthday, setBirthday] = useState(profile.birthday);
  const [nameError, setNameError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: () => repos.profiles.update(userId, { display_name: name.trim(), color, birthday }),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.profile(userId), updated);
      queryClient.invalidateQueries({ queryKey: queryKeys.members(family.id) });
      closeScreen();
    },
  });

  const submit = () => {
    const ok = displayNameSchema.safeParse(name).success;
    setNameError(ok ? null : t('validation.required'));
    if (ok) save.mutate();
  };

  return (
    <Screen modal>
      <TextField
        label={t('auth.displayName')}
        value={name}
        onChangeText={setName}
        error={nameError}
        maxLength={60}
        autoComplete="name"
      />
      <ThemedText type="smallBold">{t('profile.color')}</ThemedText>
      <View style={styles.colors} accessibilityRole="radiogroup">
        {MEMBER_COLORS.map((c, i) => {
          const selected = c === color;
          return (
            <Pressable
              key={c}
              accessibilityRole="radio"
              accessibilityLabel={t('profile.colorOption', { index: i + 1 })}
              accessibilityState={{ checked: selected }}
              onPress={() => setColor(c)}
              style={[
                styles.swatch,
                { backgroundColor: c, borderColor: selected ? theme.text : 'transparent' },
              ]}
            />
          );
        })}
      </View>
      {birthday ? (
        <>
          <DateTimeField
            label={t('profile.birthday')}
            mode="date"
            value={new Date(`${birthday}T00:00:00`)}
            onChange={(d) => setBirthday(toDateString(d))}
          />
          <Button title={t('profile.birthdayRemove')} variant="link" onPress={() => setBirthday(null)} />
        </>
      ) : (
        <Button
          title={t('profile.birthdayAdd')}
          variant="secondary"
          onPress={() => setBirthday(toDateString(new Date(2000, 0, 1)))}
        />
      )}
      {save.error ? <Notice tone="error" message={errorMessage(save.error)!} /> : null}
      <Button title={t('common.save')} loading={save.isPending} onPress={submit} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  colors: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  swatch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
  },
});

const pad = (n: number) => String(n).padStart(2, '0');
const toDateString = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
