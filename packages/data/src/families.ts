import { acceptInviteResultSchema, type AcceptInviteResult, type Role } from '@family-hub/core';

import type { SupabaseClient } from './client';
import type { Database } from './database.types';
import { unwrap } from './errors';

export type Family = Database['public']['Tables']['families']['Row'];
export type Invite = Database['public']['Tables']['invites']['Row'];

export interface Membership {
  family: Family;
  role: Role;
}

export interface Member {
  userId: string;
  role: Role;
  joinedAt: string;
  displayName: string;
  color: string | null;
  avatarUrl: string | null;
  /** YYYY-MM-DD */
  birthday: string | null;
}

export function createFamilyRepository(client: SupabaseClient) {
  return {
    /** The current user's family, or null before they create or join one. */
    async getMembership(userId: string): Promise<Membership | null> {
      const row = unwrap(
        await client
          .from('family_members')
          .select('role, families(*)')
          .eq('user_id', userId)
          .maybeSingle(),
      );
      if (!row?.families) return null;
      return { family: row.families, role: row.role };
    },

    async create(name: string): Promise<Family> {
      return unwrap(await client.rpc('create_family', { name }));
    },

    async listMembers(familyId: string): Promise<Member[]> {
      const rows = unwrap(
        await client
          .from('family_members')
          .select('user_id, role, joined_at, profiles(display_name, color, avatar_url, birthday)')
          .eq('family_id', familyId)
          .order('joined_at'),
      );
      return rows.map((r) => ({
        userId: r.user_id,
        role: r.role,
        joinedAt: r.joined_at,
        displayName: r.profiles?.display_name ?? '',
        color: r.profiles?.color ?? null,
        avatarUrl: r.profiles?.avatar_url ?? null,
        birthday: r.profiles?.birthday ?? null,
      }));
    },

    /** Open invites (not revoked, expired or used up), newest first. */
    async listInvites(familyId: string): Promise<Invite[]> {
      const rows = unwrap(
        await client
          .from('invites')
          .select('*')
          .eq('family_id', familyId)
          .is('revoked_at', null)
          .gt('expires_at', new Date().toISOString())
          .order('created_at', { ascending: false }),
      );
      return rows.filter((i) => i.uses < i.max_uses);
    },

    async createInvite(familyId: string, role: Exclude<Role, 'owner'>, maxUses = 1): Promise<Invite> {
      return unwrap(
        await client.rpc('create_invite', {
          p_family_id: familyId,
          p_role: role,
          p_max_uses: maxUses,
        }),
      );
    },

    async revokeInvite(inviteId: string) {
      unwrap(await client.rpc('revoke_invite', { p_invite_id: inviteId }));
    },

    async acceptInvite(invite: { code: string } | { token: string }): Promise<AcceptInviteResult> {
      const args = 'code' in invite ? { p_code: invite.code } : { p_token: invite.token };
      return acceptInviteResultSchema.parse(unwrap(await client.rpc('accept_invite', args)));
    },

    async setRole(familyId: string, userId: string, role: Role) {
      unwrap(
        await client.rpc('set_member_role', {
          p_family_id: familyId,
          p_user_id: userId,
          p_role: role,
        }),
      );
    },

    /** Removes a member; pass your own id to leave. */
    async removeMember(familyId: string, userId: string) {
      unwrap(await client.rpc('remove_member', { p_family_id: familyId, p_user_id: userId }));
    },

    async deleteFamily(familyId: string) {
      unwrap(await client.rpc('delete_family', { p_family_id: familyId }));
    },
  };
}

export type FamilyRepository = ReturnType<typeof createFamilyRepository>;
