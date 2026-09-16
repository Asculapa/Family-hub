import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Icon, type IconName } from './icon';

interface ButtonProps extends Omit<PressableProps, 'children'> {
  title: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'link';
  loading?: boolean;
  icon?: IconName;
}

export function Button({ title, variant = 'primary', loading, disabled, icon, style, ...props }: ButtonProps) {
  const theme = useTheme();
  const inactive = disabled || loading;

  const background = {
    primary: theme.primary,
    secondary: theme.card,
    danger: theme.dangerSoft,
    link: 'transparent',
  }[variant];
  const color = {
    primary: theme.onPrimary,
    secondary: theme.textSecondary,
    danger: theme.danger,
    link: theme.link,
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      style={(state) => [
        styles.button,
        variant === 'link' && styles.link,
        variant === 'secondary' && [styles.outlined, { borderColor: theme.cardBorder }],
        { backgroundColor: background, opacity: inactive ? 0.6 : state.pressed ? 0.8 : 1 },
        typeof style === 'function' ? style(state) : style,
      ]}
      {...props}>
      {loading ? (
        <ActivityIndicator color={color} />
      ) : (
        <View style={styles.content}>
          {icon ? <Icon name={icon} size={16} color={color} /> : null}
          <ThemedText style={[styles.title, { color }]}>{title}</ThemedText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 44,
    borderRadius: Radius.control,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  link: {
    minHeight: 44,
    paddingHorizontal: Spacing.two,
  },
  outlined: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  title: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: 600,
  },
});
