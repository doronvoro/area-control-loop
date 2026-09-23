import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Display names for auth user ids.
 *
 * Audit columns store `auth.users.id` rather than `workers.id`, because only one
 * of the three actor kinds this app admits has a workers row:
 *
 *   worker (inspector / action_worker)  -> workers row
 *   customer owner (e.g. ארץ גשור)      -> customers row, NO workers row
 *   platform admin                      -> possibly neither
 *
 * PostgREST cannot embed `auth.users` and there is no profiles table, so a name
 * costs a lookup. getApiContext already does exactly these two queries for the
 * current user (lib/api/auth-context.ts); this is the same pair, batched over a
 * set of ids so a list costs two round-trips rather than two per row.
 *
 * An id that resolves to neither is simply absent from the map. Callers render
 * nothing in that case — never the raw UUID, which tells a reader less than a
 * blank does.
 *
 * PASS adminClient, NOT ctx.supabase. Under RLS a worker cannot read the
 * `customers` row of their own tenant, so an owner-marked reading would resolve
 * to a blank for everyone but the owner. This discloses nothing new: the ids
 * handed in come from rows the caller has already read through RLS, and all this
 * adds is the name behind an id they can already see. It is a display lookup
 * after an authorization check, the same shape as every write in this codebase.
 */
export async function resolveActorNames(
  supabase: SupabaseClient,
  userIds: (string | null | undefined)[]
): Promise<Map<string, string>> {
  const ids = [...new Set(userIds.filter((id): id is string => !!id))];
  const names = new Map<string, string>();

  if (ids.length === 0) return names;

  const [workers, customers] = await Promise.all([
    supabase.from('workers').select('user_id, name').in('user_id', ids),
    supabase.from('customers').select('user_id, name').in('user_id', ids),
  ]);

  // Workers first, then customers fill only what is still missing. Both tables
  // are UNIQUE on user_id, so an id can appear in at most one row of each; where
  // someone is both, the worker name is the one the rest of the app shows.
  for (const row of (workers.data ?? []) as { user_id: string; name: string }[]) {
    if (row.user_id && row.name) names.set(row.user_id, row.name);
  }
  for (const row of (customers.data ?? []) as { user_id: string; name: string }[]) {
    if (row.user_id && row.name && !names.has(row.user_id)) names.set(row.user_id, row.name);
  }

  return names;
}
