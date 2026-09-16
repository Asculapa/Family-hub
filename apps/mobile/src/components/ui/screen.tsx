import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useActivity } from '@/hooks/use-activity';
import { useNow } from '@/hooks/use-now';
import { useTheme } from '@/hooks/use-theme';
import { useUserId } from '@/providers/session-provider';

import { Icon, Icons, type IconName } from './icon';

interface ScreenProps {
  title?: string;
  subtitle?: string;
  /** Small uppercase label above the title. */
  eyebrow?: string;
  /** Shown to the right of the title, e.g. an add button. */
  headerAction?: ReactNode;
  /** Larger title, used for the Home greeting. */
  largeTitle?: boolean;
  children: ReactNode;
  /** A main tab: shows the app header; the tab bar handles the bottom inset. */
  tabs?: boolean;
  /** Screen is presented as a modal with its own header. */
  modal?: boolean;
  refreshControl?: React.ComponentProps<typeof ScrollView>['refreshControl'];
}

/** Scrollable, keyboard-aware page with a title. */
export function Screen({
  title,
  subtitle,
  eyebrow,
  headerAction,
  largeTitle,
  children,
  tabs,
  modal,
  refreshControl,
}: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: theme.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.flex}
        refreshControl={refreshControl}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: (modal ? 0 : insets.top) + (tabs ? TAB_TOP : Spacing.four),
            paddingBottom: (tabs ? 0 : insets.bottom) + Spacing.four,
          },
        ]}>
        <View style={[styles.inner, tabs && styles.tabInner]}>
          {tabs ? <AppHeader /> : null}
          {title ? (
            <View style={[styles.header, tabs && styles.tabHeader]}>
              <View style={styles.titles}>
                {eyebrow ? <ThemedText type="eyebrow">{eyebrow}</ThemedText> : null}
                {subtitle ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    {subtitle}
                  </ThemedText>
                ) : null}
                <ThemedText type="subtitle" accessibilityRole="header" style={largeTitle && styles.largeTitle}>
                  {title}
                </ThemedText>
              </View>
              {headerAction}
            </View>
          ) : null}
          {children}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/** App name and the activity bell, shown on the main tabs. */
function AppHeader() {
  const { t } = useTranslation();
  const theme = useTheme();
  const userId = useUserId();
  // Dot on the bell when someone else did something in the last day.
  const latest = useActivity(1).data?.[0];
  const now = useNow();
  const unread = !!latest && latest.actor_id !== userId && now - Date.parse(latest.created_at) < DAY_MS;

  return (
    <View style={styles.appHeader}>
      <View style={styles.brand}>
        <View style={[styles.logo, { backgroundColor: theme.primary }]}>
          <Icon name={Icons.sparkles} size={16} color={theme.onPrimary} />
        </View>
        <ThemedText style={styles.brandName}>{t('common.appName')}</ThemedText>
      </View>
      <View>
        <RoundButton icon={Icons.bell} label={t('activity.title')} onPress={() => router.push('/activity')} />
        {unread ? <View style={[styles.badge, { backgroundColor: BADGE }]} pointerEvents="none" /> : null}
      </View>
    </View>
  );
}

/** Circular icon button on a card background. */
export function RoundButton({
  icon,
  label,
  onPress,
  primary,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  primary?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.round,
        primary
          ? { backgroundColor: theme.primary, borderColor: theme.primary }
          : { backgroundColor: theme.card, borderColor: theme.cardBorder },
        pressed && { opacity: 0.7 },
      ]}>
      <Icon name={icon} size={18} color={primary ? theme.onPrimary : theme.textSecondary} />
    </Pressable>
  );
}

const TAB_TOP = 28;
const DAY_MS = 86_400_000;
const BADGE = '#F43F5E';

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing.four - 4,
  },
  inner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    gap: Spacing.three,
  },
  tabInner: {
    gap: 28,
  },
  appHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    position: 'absolute',
    top: 9,
    right: 11,
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 2,
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: Radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandName: {
    fontSize: 17,
    fontWeight: 600,
    letterSpacing: -0.5,
  },
  round: {
    width: 40,
    height: 40,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.three,
    marginBottom: Spacing.two,
  },
  /** 28pt gap above, 20pt below, as in the design. */
  tabHeader: {
    marginBottom: -Spacing.two,
  },
  titles: {
    flex: 1,
    gap: Spacing.one,
  },
  largeTitle: {
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -1.4,
  },
});
