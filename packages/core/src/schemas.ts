import { z } from 'zod';

import { ROLES } from './roles';

export const MAX_FAMILY_MEMBERS = 12;
export const INVITE_TTL_DAYS = 7;
export const INVITE_MAX_USES = 10;

export const roleSchema = z.enum(ROLES);
export const listTypeSchema = z.enum(['shopping', 'todo']);

export const inviteCodeSchema = z.string().regex(/^\d{6}$/, 'Code must be 6 digits');

export const emailSchema = z.email();
export const passwordSchema = z.string().min(8);

export const listNameSchema = z.string().trim().min(1).max(60);
export const itemTitleSchema = z.string().trim().min(1).max(200);
export const itemNoteSchema = z.string().max(1000);
export const itemUnitSchema = z.string().trim().max(20);

/** Quantity typed by the user: empty means none; accepts "1,5" as well as "1.5". */
export const quantityInputSchema = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : Number(v.replace(',', '.'))))
  .refine((v) => v === null || (Number.isFinite(v) && v > 0), 'Quantity must be a positive number');
