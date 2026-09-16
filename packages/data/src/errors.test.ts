import { describe, expect, it } from 'vitest';

import { AppError, toAppError, unwrap } from './errors';

describe('toAppError', () => {
  it('maps auth error codes', () => {
    expect(toAppError({ code: 'invalid_credentials', message: 'x' }).code).toBe('invalidCredentials');
    expect(toAppError({ code: 'email_exists' }).code).toBe('userExists');
  });

  it('maps RPC exceptions by message', () => {
    expect(toAppError({ message: 'last owner', code: 'P0001' }).code).toBe('lastOwner');
    expect(toAppError({ message: 'not allowed', code: '42501' }).code).toBe('notAllowed');
    expect(toAppError({ message: 'email not verified', code: '42501' }).code).toBe('emailNotVerified');
  });

  it('falls back to unknown', () => {
    expect(toAppError(new Error('boom')).code).toBe('unknown');
  });
});

describe('unwrap', () => {
  it('returns data or throws an AppError', () => {
    expect(unwrap({ data: 1, error: null })).toBe(1);
    expect(() => unwrap({ data: null, error: { message: 'last owner' } })).toThrow(AppError);
  });
});
