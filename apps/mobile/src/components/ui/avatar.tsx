import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

/** Up to two initials, e.g. "Anna Novak" → "AN". */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? '?').slice(0, 2);
  return letters.toUpperCase();
}

/** `#RRGGBB` at the given opacity. */
function tint(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1, 7), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** Member initials on a soft tint of their color. */
export function Avatar({
  name,
  color,
  size = 40,
  ring,
  inverse,
}: {
  name: string;
  color: string | null;
  size?: number;
  /** Outline in this color, to separate overlapping avatars. */
  ring?: string;
  /** White circle with accent initials, for colored backgrounds. */
  inverse?: boolean;
}) {
  const theme = useTheme();
  const base = color && /^#[0-9a-f]{6}$/i.test(color) ? color : theme.textSecondary;

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: inverse ? 'rgba(255, 255, 255, 0.92)' : theme.card,
        },
        ring ? { borderWidth: 2, borderColor: ring } : null,
      ]}>
      {inverse ? null : (
        <View style={[StyleSheet.absoluteFill, { borderRadius: size / 2, backgroundColor: tint(base, 0.22) }]} />
      )}
      <ThemedText
        style={[
          styles.initials,
          { color: inverse ? theme.primary : base, fontSize: size * 0.3, lineHeight: size * 0.4 },
        ]}>
        {initials(name)}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  initials: {
    fontWeight: 700,
  },
});
