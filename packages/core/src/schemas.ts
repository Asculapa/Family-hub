import { z } from 'zod';

import { ROLES } from './roles';

export const MAX_FAMILY_MEMBERS = 12;
export const INVITE_TTL_DAYS = 7;
export const INVITE_MAX_USES = 10;

export const roleSchema = z.enum(ROLES);
export const listTypeSchema = z.enum(['shopping', 'todo']);

export const inviteCodeSchema = z.string().regex(/^\d{6}$/, 'Code must be 6 digits');

export const passwordSchema = z.string().min(8);

export const listItemInputSchema = z.object({
  id: z.uuid(),
  listId: z.uuid(),
  familyId: z.uuid(),
  title: z.string().trim().min(1).max(200),
  quantity: z.number().positive().nullable().default(null),
  unit: z.string().max(20).nullable().default(null),
  category: z.string().max(50).nullable().default(null),
  note: z.string().max(1000).nullable().default(null),
  assigneeId: z.uuid().nullable().default(null),
  dueAt: z.iso.datetime({ offset: true }).nullable().default(null),
});
export type ListItemInput = z.input<typeof listItemInputSchema>;
export type ListItem = z.output<typeof listItemInputSchema>;

export const createInviteSchema = z.object({
  familyId: z.uuid(),
  role: z.enum(['adult', 'child']),
  maxUses: z.number().int().min(1).max(INVITE_MAX_USES).default(1),
});
export type CreateInviteInput = z.input<typeof createInviteSchema>;
