// Drains notification_queue to Expo Push (APNs / FCM). Called by the database
// (kick_push_sender, pg_cron) with the service role key. Web Push joins in v2.
import { createClient } from 'npm:@supabase/supabase-js@2';

import {
  buildMessages,
  chunk,
  EXPO_BATCH,
  failures,
  tokensToForget,
  type ClaimedNotification,
  type ExpoTicket,
} from '../_shared/push.ts';

const EXPO_PUSH_URL = Deno.env.get('EXPO_PUSH_URL') ?? 'https://exp.host/--/api/v2/push/send';
const EXPO_ACCESS_TOKEN = Deno.env.get('EXPO_ACCESS_TOKEN');

Deno.serve(async (req) => {
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  if (req.headers.get('Authorization') !== `Bearer ${serviceKey}`) {
    return new Response('Forbidden', { status: 403 });
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey, { auth: { persistSession: false } });
  const { data, error } = await admin.rpc('claim_notifications', { p_limit: 500 });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as ClaimedNotification[];
  const { messages, ids } = buildMessages(rows);
  const withoutDevice = rows.filter((r) => r.tokens.length === 0).map((r) => r.id);
  if (withoutDevice.length) await admin.rpc('record_push_errors', { p_ids: withoutDevice, p_error: 'no_devices' });

  let sent = 0;
  const forget: string[] = [];
  const failed = new Map<string, string>();
  const batches = chunk(messages, EXPO_BATCH);
  const idBatches = chunk(ids, EXPO_BATCH);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i]!;
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${EXPO_ACCESS_TOKEN}` } : {}),
      },
      body: JSON.stringify(batch),
    });
    const json = await res.json().catch(() => ({}));
    const tickets = (json.data ?? []) as ExpoTicket[];
    if (!res.ok || tickets.length !== batch.length) {
      for (const id of idBatches[i]!) failed.set(id, `expo_${res.status}`);
      continue;
    }
    sent += tickets.filter((t) => t.status === 'ok').length;
    forget.push(...tokensToForget(batch, tickets));
    for (const [id, reason] of failures(idBatches[i]!, tickets)) failed.set(id, reason);
  }

  if (forget.length) await admin.from('push_tokens').delete().in('token', forget);
  for (const reason of new Set(failed.values())) {
    const failedIds = [...failed].filter(([, r]) => r === reason).map(([id]) => id);
    await admin.rpc('record_push_errors', { p_ids: failedIds, p_error: reason });
  }

  return Response.json({ claimed: rows.length, messages: messages.length, sent, forgotten: forget.length, failed: failed.size });
});
