import { Pressable, StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { Icon, type IconName } from './icon';

interface CardProps extends ViewProps {
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

/** White rounded surface with a hairline border and a soft shadow. */
export function Card({ onPress, style, children, accessibilityLabel, accessibilityHint, ...props }: CardProps) {
  const theme = useTheme();
  const surface: StyleProp<ViewStyle> = [
    styles.card,
    { backgroundColor: theme.card, borderColor: theme.cardBorder, shadowColor: theme.shadow },
    style,
  ];

  if (!onPress) {
    return (
      <View style={surface} {...props}>
        {children}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      style={({ pressed }) => [surface, pressed && { backgroundColor: theme.backgroundElement }]}
      {...props}>
      {children}
    </Pressable>
  );
}

/** Rounded square holding an icon, tinted with a soft background. */
export function IconTile({
  name,
  color,
  background,
  size = 40,
  iconSize = size / 2,
  radius = Radius.control,
}: {
  name: IconName;
  color: string;
  background: string;
  size?: number;
  iconSize?: number;
  radius?: number;
}) {
  return (
    <View style={[styles.tile, { width: size, height: size, borderRadius: radius, backgroundColor: background }]}>
      <Icon name={name} color={color} size={iconSize} />
    </View>
  );
}

/** Soft tile colors for features; readable in both themes. */
export const TileTones = {
  indigo: { color: '#4F46E5', background: 'rgba(99, 102, 241, 0.12)' },
  emerald: { color: '#059669', background: 'rgba(16, 185, 129, 0.12)' },
  violet: { color: '#7C3AED', background: 'rgba(139, 92, 246, 0.12)' },
  orange: { color: '#EA580C', background: 'rgba(249, 115, 22, 0.12)' },
  amber: { color: '#D97706', background: 'rgba(245, 158, 11, 0.14)' },
  sky: { color: '#0284C7', background: 'rgba(14, 165, 233, 0.12)' },
  cyan: { color: '#0891B2', background: 'rgba(6, 182, 212, 0.12)' },
  pink: { color: '#DB2777', background: 'rgba(236, 72, 153, 0.12)' },
} as const;

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
