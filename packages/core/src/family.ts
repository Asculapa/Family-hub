import { z } from 'zod';

import type { Role } from './roles';

export const INVITE_BASE_URL = 'https://familyhub.app/join/';

export function inviteUrl(token: string): string {
  return INVITE_BASE_URL + token;
}

export const acceptInviteResultSchema = z.object({
  status: z.enum([
    'joined',
    'invalid',
    'rate_limited',
    'already_member',
    'family_full',
    'email_not_verified',
  ]),
  family_id: z.uuid().optional(),
});
export type AcceptInviteResult = z.infer<typeof acceptInviteResultSchema>;

/** Roles the given role may assign in an invite, in display order. */
export function invitableRoles(role: Role): Exclude<Role, 'owner'>[] {
  if (role === 'owner') return ['adult', 'child'];
  if (role === 'adult') return ['child'];
  return [];
}

export const familyNameSchema = z.string().trim().min(1).max(80);
export const displayNameSchema = z.string().trim().min(1).max(60);
