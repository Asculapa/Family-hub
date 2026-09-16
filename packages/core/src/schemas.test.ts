import { describe, expect, it } from 'vitest';

import { inviteCodeSchema, itemTitleSchema, quantityInputSchema } from './schemas';

describe('schemas', () => {
  it('accepts only 6-digit invite codes', () => {
    expect(inviteCodeSchema.safeParse('123456').success).toBe(true);
    expect(inviteCodeSchema.safeParse('12345').success).toBe(false);
    expect(inviteCodeSchema.safeParse('12a456').success).toBe(false);
  });

  it('trims item titles and rejects blank ones', () => {
    expect(itemTitleSchema.parse('  Milk ')).toBe('Milk');
    expect(itemTitleSchema.safeParse('   ').success).toBe(false);
  });

  it('parses quantities with either decimal separator', () => {
    expect(quantityInputSchema.parse('')).toBeNull();
    expect(quantityInputSchema.parse('1,5')).toBe(1.5);
    expect(quantityInputSchema.parse('2')).toBe(2);
    expect(quantityInputSchema.safeParse('0').success).toBe(false);
    expect(quantityInputSchema.safeParse('abc').success).toBe(false);
  });
});
