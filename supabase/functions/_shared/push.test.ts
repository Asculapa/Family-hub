import { describe, expect, it } from 'vitest';

import { buildMessages, chunk, failures, tokensToForget, type ClaimedNotification } from './push.ts';

const row = (overrides: Partial<ClaimedNotification>): ClaimedNotification => ({
  id: 'n1',
  type: 'item_assigned',
  title: 'Olena assigned you a task',
  body: 'Tidy room',
  data: { url: '/item/1' },
  category: 'task',
  silent: false,
  quiet: false,
  tokens: ['ExponentPushToken[a]'],
  ...overrides,
});

describe('buildMessages', () => {
  it('sends one message per device with the deep link and action category', () => {
    const { messages, ids } = buildMessages([row({ tokens: ['ExponentPushToken[a]', 'ExponentPushToken[b]'] })]);
    expect(ids).toEqual(['n1', 'n1']);
    expect(messages[0]).toEqual({
      to: 'ExponentPushToken[a]',
      title: 'Olena assigned you a task',
      body: 'Tidy room',
      data: { url: '/item/1', type: 'item_assigned', notificationId: 'n1' },
      sound: 'default',
      categoryId: 'task',
      channelId: 'default',
      priority: 'high',
    });
  });

  it('delivers without sound in quiet hours', () => {
    const { messages } = buildMessages([row({ quiet: true })]);
    expect(messages[0]).toMatchObject({ sound: null, priority: 'normal' });
  });

  it('sends data-only pushes for silent notifications', () => {
    const { messages } = buildMessages([row({ type: 'location_refresh', silent: true, title: null, body: null })]);
    expect(messages[0]).toEqual({
      to: 'ExponentPushToken[a]',
      data: { url: '/item/1', type: 'location_refresh', notificationId: 'n1' },
      priority: 'normal',
      _contentAvailable: true,
    });
  });

  it('skips users without devices', () => {
    expect(buildMessages([row({ tokens: [] })]).messages).toEqual([]);
  });
});

describe('tickets', () => {
  const { messages, ids } = buildMessages([row({ tokens: ['ExponentPushToken[a]', 'ExponentPushToken[b]'] })]);
  const tickets = [
    { status: 'ok' as const, id: 't1' },
    { status: 'error' as const, message: 'gone', details: { error: 'DeviceNotRegistered' } },
  ];

  it('forgets tokens of uninstalled apps', () => {
    expect(tokensToForget(messages, tickets)).toEqual(['ExponentPushToken[b]']);
  });

  it('reports failures per notification', () => {
    expect(failures(ids, tickets)).toEqual(new Map([['n1', 'DeviceNotRegistered']]));
  });
});

describe('chunk', () => {
  it('splits into batches', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});
