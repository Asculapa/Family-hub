import { toAppError } from '@family-hub/data';
import { useTranslation } from 'react-i18next';

/** Translates any thrown error into a user-facing message. */
export function useErrorMessage() {
  const { t } = useTranslation();
  return (error: unknown): string | null =>
    error ? t(`errors.${toAppError(error).code}`) : null;
}
