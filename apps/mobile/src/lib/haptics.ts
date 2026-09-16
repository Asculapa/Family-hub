import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/** Light tap feedback for marking items done (FR-9.3). */
export function tapFeedback() {
  if (Platform.OS !== 'web') void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}
