import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon, Icons } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useSuggestions, type Suggestion } from '@/hooks/use-suggestions';
import { useTheme } from '@/hooks/use-theme';

interface AddItemBarProps {
  listId: string;
  placeholder: string;
  onAdd: (title: string, categoryId: string | null) => void;
  suggest: boolean;
  /** No outer padding and a smaller field, for use inside a card. */
  compact?: boolean;
}

/** Quick add with "recently bought" suggestions (FR-3.5). */
export function AddItemBar({ listId, placeholder, onAdd, suggest, compact }: AddItemBarProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [text, setText] = useState('');
  const suggestions = useSuggestions(listId, suggest ? text : '');

  const submit = (title = text, categoryId: string | null = null) => {
    if (!title.trim()) return;
    onAdd(title.trim(), categoryId);
    setText('');
  };

  return (
    <View style={[styles.container, compact && styles.compact]}>
      <View style={styles.bar}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          accessibilityLabel={placeholder}
          placeholderTextColor={theme.textSecondary}
          onSubmitEditing={() => submit()}
          submitBehavior="submit"
          returnKeyType="done"
          maxLength={200}
          style={[
            styles.input,
            compact && styles.compactInput,
            { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.cardBorder },
          ]}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('lists.add')}
          accessibilityState={{ disabled: !text.trim() }}
          disabled={!text.trim()}
          onPress={() => submit()}
          style={({ pressed }) => [
            styles.addButton,
            compact && styles.compactButton,
            { backgroundColor: theme.primary, opacity: !text.trim() ? 0.5 : pressed ? 0.8 : 1 },
          ]}>
          <Icon name={Icons.add} size={20} color={theme.onPrimary} />
        </Pressable>
      </View>
      {suggestions.length > 0 ? (
        <View style={styles.suggestions}>
          {suggestions.map((s: Suggestion) => (
            <Pressable
              key={s.title}
              accessibilityRole="button"
              accessibilityLabel={`${t('lists.add')} ${s.title}`}
              onPress={() => submit(s.title, s.categoryId)}
              style={({ pressed }) => [
                styles.chip,
                { backgroundColor: pressed ? theme.primarySoft : theme.card, borderColor: theme.cardBorder },
              ]}>
              <ThemedText type="smallBold" themeColor="link">
                ＋ {s.title}
              </ThemedText>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.four - 4,
    paddingVertical: Spacing.three,
  },
  compact: {
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  bar: {
    flexDirection: 'row',
    gap: Spacing.two,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderRadius: Radius.control,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  compactInput: {
    minHeight: 40,
    fontSize: 14,
  },
  compactButton: {
    width: 40,
    height: 40,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: Radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
