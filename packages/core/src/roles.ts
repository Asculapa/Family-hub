/** Family roles and what each may do (spec section 6, "Permissions by role"). */
export const ROLES = ['owner', 'adult', 'child'] as const;
export type Role = (typeof ROLES)[number];

export type Action =
  | 'item.edit'
  | 'item.delete'
  | 'list.manage'
  | 'event.edit'
  | 'event.editOwn'
  | 'invite.adult'
  | 'invite.child'
  | 'member.manage'
  | 'location.allowChild'
  | 'family.delete';

const PERMISSIONS: Record<Action, readonly Role[]> = {
  'item.edit': ['owner', 'adult', 'child'],
  'item.delete': ['owner', 'adult'],
  'list.manage': ['owner', 'adult'],
  'event.edit': ['owner', 'adult'],
  'event.editOwn': ['owner', 'adult', 'child'],
  'invite.adult': ['owner'],
  'invite.child': ['owner', 'adult'],
  'member.manage': ['owner'],
  'location.allowChild': ['owner', 'adult'],
  'family.delete': ['owner'],
};

export function can(role: Role, action: Action): boolean {
  return PERMISSIONS[action].includes(role);
}

/** Role a member may assign when creating an invite. */
export function canInvite(inviter: Role, invitee: Exclude<Role, 'owner'>): boolean {
  return can(inviter, invitee === 'adult' ? 'invite.adult' : 'invite.child');
}
