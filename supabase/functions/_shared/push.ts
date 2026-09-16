// Pure helpers for send-push; no Deno APIs, so they are unit-tested with Vitest.

export interface ClaimedNotification {
  id: string;
  type: string;
  title: string | null;
  body: string | null;
  data: Record<string, unknown>;
  category: string | null;
  silent: boolean;
  /** Recipient is in quiet hours: deliver without sound. */
  quiet: boolean;
  tokens: string[];
}

/** https://docs.expo.dev/push-notifications/sending-notifications/#message-request-format */
export interface ExpoMessage {
  to: string;
  title?: string;
  body?: string;
  data: Record<string, unknown>;
  sound?: 'default' | null;
  categoryId?: string;
  channelId?: string;
  priority: 'default' | 'normal' | 'high';
  _contentAvailable?: boolean;
}

export interface ExpoTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

export const EXPO_BATCH = 100;

/** One message per device; `ids[i]` is the notification behind `messages[i]`. */
export function buildMessages(rows: ClaimedNotification[]) {
  const messages: ExpoMessage[] = [];
  const ids: string[] = [];
  for (const r of rows) {
    for (const to of r.tokens) {
      const data = { ...r.data, type: r.type, notificationId: r.id };
      messages.push(
        r.silent
          ? { to, data, priority: 'normal', _contentAvailable: true }
          : {
              to,
              title: r.title ?? undefined,
              body: r.body ?? undefined,
              data,
              sound: r.quiet ? null : 'default',
              categoryId: r.category ?? undefined,
              channelId: 'default',
              priority: r.quiet ? 'normal' : 'high',
            },
      );
      ids.push(r.id);
    }
  }
  return { messages, ids };
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Tokens of uninstalled apps, reported per message in the ticket list. */
export function tokensToForget(messages: ExpoMessage[], tickets: ExpoTicket[]): string[] {
  return tickets.flatMap((t, i) =>
    t.status === 'error' && t.details?.error === 'DeviceNotRegistered' && messages[i] ? [messages[i].to] : [],
  );
}

/** Notification ids whose messages failed, with the reason. */
export function failures(ids: string[], tickets: ExpoTicket[]): Map<string, string> {
  const out = new Map<string, string>();
  tickets.forEach((t, i) => {
    if (t.status === 'error' && ids[i]) out.set(ids[i], t.details?.error ?? t.message ?? 'error');
  });
  return out;
}
