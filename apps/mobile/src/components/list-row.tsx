import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Icon, Icons } from '@/components/ui/icon';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface ListRowProps {
  title: string;
  subtitle?: string;
  left?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
  accessibilityHint?: string;
  /** Show a chevron when pressable and nothing else is on the right. */
  chevron?: boolean;
}

export function ListRow({ title, subtitle, left, right, onPress, accessibilityHint, chevron = true }: ListRowProps) {
  const theme = useTheme();

  return (
    <Card onPress={onPress} accessibilityHint={accessibilityHint} style={styles.row}>
      {left}
      <View style={styles.text}>
        <ThemedText style={styles.title}>{title}</ThemedText>
        {subtitle ? (
          <ThemedText type="caption" themeColor="textSecondary">
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {right ?? (onPress && chevron ? <Icon name={Icons.chevronRight} size={16} color={theme.textMuted} /> : null)}
    </Card>
  );
}

type Action = { label: string; onPress: () => void };

/** A titled block: 12pt under the title, 10pt between its children. */
export function Section({ title, action, children }: { title: string; action?: Action; children: ReactNode }) {
  return (
    <View style={styles.block}>
      <SectionTitle action={action} flush>
        {title}
      </SectionTitle>
      <View style={styles.blockBody}>{children}</View>
    </View>
  );
}

/** Section heading with an optional action link on the right. */
export function SectionTitle({
  children,
  action,
  flush,
}: {
  children: string;
  action?: Action;
  /** No top margin; used inside `Section`. */
  flush?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.section, !flush && styles.spaced]}>
      <ThemedText type="heading" accessibilityRole="header">
        {children}
      </ThemedText>
      {action ? (
        <Pressable accessibilityRole="link" onPress={action.onPress} hitSlop={12}>
          {({ pressed }) => (
            <ThemedText type="caption" style={{ color: theme.link, opacity: pressed ? 0.6 : 1 }}>
              {action.label}
            </ThemedText>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - 4,
    padding: Spacing.three,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 600,
  },
  section: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  spaced: {
    marginTop: Spacing.three,
  },
  block: {
    gap: Spacing.three - 4,
  },
  blockBody: {
    gap: Spacing.two + 2,
  },
});
