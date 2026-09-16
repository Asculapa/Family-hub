import { describe, expect, it } from 'vitest';

import { acceptInviteResultSchema, invitableRoles, inviteUrl } from './family';

describe('family helpers', () => {
  it('builds invite links on the app domain', () => {
    expect(inviteUrl('abc')).toBe('https://familyhub.app/join/abc');
  });

  it('matches invitable roles to the permission table', () => {
    expect(invitableRoles('owner')).toEqual(['adult', 'child']);
    expect(invitableRoles('adult')).toEqual(['child']);
    expect(invitableRoles('child')).toEqual([]);
  });

  it('parses accept_invite results', () => {
    expect(acceptInviteResultSchema.parse({ status: 'invalid' })).toEqual({ status: 'invalid' });
    expect(() => acceptInviteResultSchema.parse({ status: 'weird' })).toThrow();
  });
});
