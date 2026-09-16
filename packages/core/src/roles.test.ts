import { describe, expect, it } from 'vitest';

import { can, canInvite } from './roles';

describe('role permissions', () => {
  it('lets every role edit items but only adults and owners delete them', () => {
    expect(can('child', 'item.edit')).toBe(true);
    expect(can('child', 'item.delete')).toBe(false);
    expect(can('adult', 'item.delete')).toBe(true);
  });

  it('allows only owners to invite adults', () => {
    expect(canInvite('owner', 'adult')).toBe(true);
    expect(canInvite('adult', 'adult')).toBe(false);
    expect(canInvite('adult', 'child')).toBe(true);
    expect(canInvite('child', 'child')).toBe(false);
  });

  it('reserves member management and family deletion for owners', () => {
    expect(can('owner', 'member.manage')).toBe(true);
    expect(can('adult', 'member.manage')).toBe(false);
    expect(can('adult', 'family.delete')).toBe(false);
  });
});
