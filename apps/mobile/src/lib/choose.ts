import { Alert, Platform } from 'react-native';

export interface Choice<T> {
  label: string;
  value: T;
  style?: 'cancel' | 'destructive' | 'default';
}

/** Up to three buttons (Android's limit); resolves with the chosen value. */
export function choose<T>(title: string, message: string, choices: Choice<T>[]): Promise<T> {
  if (Platform.OS === 'web') {
    // The first non-cancel choice on OK, the cancel choice otherwise.
    const primary = choices.find((c) => c.style !== 'cancel')!;
    const cancel = choices.find((c) => c.style === 'cancel') ?? primary;
    return Promise.resolve(window.confirm(`${title}\n\n${message}\n\n${primary.label}?`) ? primary.value : cancel.value);
  }
  return new Promise((resolve) =>
    Alert.alert(
      title,
      message,
      choices.map((c) => ({ text: c.label, style: c.style, onPress: () => resolve(c.value) })),
      { cancelable: true, onDismiss: () => resolve((choices.find((c) => c.style === 'cancel') ?? choices[0]!).value) },
    ),
  );
}
