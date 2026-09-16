import { describe, expect, it } from 'vitest';

import { inviteCodeSchema, listItemInputSchema } from './schemas';

describe('schemas', () => {
  it('accepts only 6-digit invite codes', () => {
    expect(inviteCodeSchema.safeParse('123456').success).toBe(true);
    expect(inviteCodeSchema.safeParse('12345').success).toBe(false);
    expect(inviteCodeSchema.safeParse('12a456').success).toBe(false);
  });

  it('trims item titles and fills optional fields with null', () => {
    const item = listItemInputSchema.parse({
      id: '11111111-1111-4111-8111-111111111111',
      listId: '22222222-2222-4222-8222-222222222222',
      familyId: '33333333-3333-4333-8333-333333333333',
      title: '  Milk ',
    });
    expect(item.title).toBe('Milk');
    expect(item.quantity).toBeNull();
  });
});
