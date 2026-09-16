/** Error codes the UI translates; raised by RPCs in supabase/migrations. */
export type AppErrorCode =
  | 'notAllowed'
  | 'lastOwner'
  | 'alreadyInFamily'
  | 'emailNotVerified'
  | 'invalidCredentials'
  | 'emailNotConfirmed'
  | 'userExists'
  | 'weakPassword'
  | 'rateLimited'
  | 'network'
  | 'unknown';

export class AppError extends Error {
  constructor(
    readonly code: AppErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'AppError';
  }
}

interface ErrorLike {
  message?: string;
  code?: string;
  status?: number;
}

export function toAppError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  const e = (error ?? {}) as ErrorLike;
  const message = e.message ?? String(error);

  switch (e.code) {
    case 'invalid_credentials':
      return new AppError('invalidCredentials', message);
    case 'email_not_confirmed':
      return new AppError('emailNotConfirmed', message);
    case 'user_already_exists':
    case 'email_exists':
      return new AppError('userExists', message);
    case 'weak_password':
      return new AppError('weakPassword', message);
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return new AppError('rateLimited', message);
  }

  if (message === 'last owner') return new AppError('lastOwner', message);
  if (message === 'already in a family') return new AppError('alreadyInFamily', message);
  if (message === 'email not verified') return new AppError('emailNotVerified', message);
  if (message === 'not allowed' || e.code === '42501') return new AppError('notAllowed', message);
  if (/network|fetch/i.test(message)) return new AppError('network', message);
  return new AppError('unknown', message);
}

type Ok<R> = Extract<R, { error: null }>;
type OkData<R extends { data: unknown }> = [Ok<R>] extends [never] ? R['data'] : Ok<R>['data'];

/** Unwraps a supabase-js result, throwing an AppError on failure. */
export function unwrap<R extends { data: unknown; error: unknown }>(result: R): OkData<R> {
  if (result.error) throw toAppError(result.error);
  return result.data as OkData<R>;
}

/** Throws an AppError if a supabase-js call without data failed. */
export function check(result: { error: unknown }): void {
  if (result.error) throw toAppError(result.error);
}
