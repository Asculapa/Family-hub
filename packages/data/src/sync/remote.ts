import type { SupabaseClient } from '../client';
import { AppError, toAppError } from '../errors';
import type { SyncRemote, SyncTable } from './types';

const PAGE = 1000;

interface Result {
  data: unknown;
  error: { message: string; code?: string } | null;
  status: number;
}

// Offline, timeouts and 5xx are retried later; anything else is a rejection.
function check<T>(res: Result): T {
  if (!res.error) return res.data as T;
  if (!res.status || res.status >= 500 || /fetch|network/i.test(res.error.message)) {
    throw new AppError('network', res.error.message);
  }
  throw toAppError(res.error);
}

type Row = { id: string; updated_at: string } & Record<string, unknown>;

export function createSupabaseRemote(client: SupabaseClient): SyncRemote {
  // Table names are dynamic here; the typed rows are restored by the engine's callers.
  const from = (table: SyncTable) => client.from(table as 'lists');

  return {
    async pull(table, familyId, since) {
      const rows: Row[] = [];
      for (let offset = 0; ; offset += PAGE) {
        let query = from(table).select('*').eq('family_id', familyId);
        if (since) query = query.gt('updated_at', since);
        const page = check<Row[]>(
          await query.order('updated_at').order('id').range(offset, offset + PAGE - 1),
        );
        rows.push(...page);
        if (page.length < PAGE) return rows;
      }
    },

    async insert(table, row) {
      const res = await from(table).insert(row as never).select('*').single();
      // Already inserted by an earlier attempt whose response was lost.
      if (res.error?.code === '23505') {
        const existing = await this.fetch(table, row.id as string);
        if (existing) return existing;
      }
      return check<Row>(res);
    },

    async update(table, id, patch) {
      return check<Row>(await from(table).update(patch as never).eq('id', id).select('*').single());
    },

    async fetch(table, id) {
      return check<Row | null>(await from(table).select('*').eq('id', id).maybeSingle());
    },
  };
}
