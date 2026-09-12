import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Centralized customer-area queries.
 * Eliminates duplicate customer_areas lookups across routes.
 */

/** Get area IDs accessible to a customer. */
export async function getCustomerAreaIds(
  supabase: SupabaseClient,
  customerId: string
): Promise<string[]> {
  const { data } = await supabase
    .from('customer_areas')
    .select('area_id')
    .eq('customer_id', customerId);
  return (data || []).map((ca: any) => ca.area_id);
}

/** Get areas with crops for a customer (used in form dropdowns). */
export async function getCustomerAreasWithCrops(
  supabase: SupabaseClient,
  customerId: string
) {
  const { data } = await supabase
    .from('customer_areas')
    .select('areas(*, crops(*))')
    .eq('customer_id', customerId);
  return (data || []).map((ca: any) => ca.areas).filter(Boolean);
}

/** Get all area IDs — for admin users who can access everything. */
export async function getAllAreaIds(supabase: SupabaseClient): Promise<string[]> {
  const { data } = await supabase.from('areas').select('id');
  return (data || []).map((a: any) => a.id);
}

/**
 * Get accessible area IDs.
 *
 * BRANCH ORDER IS LOAD-BEARING — do not "tidy" it back.
 *
 * A customer id, when present, always wins. This used to check `isAdmin` first,
 * which meant an admin passing an explicit customer still received every area in
 * the database: the nine routes accepting `?customerId=` silently ignored it for
 * exactly the user who most needed it to work. The old order looks deliberate,
 * which is why it survived so long.
 *
 * An admin with no customer selected now gets NOTHING, not everything. Until
 * the switcher shipped they saw every tenant at once, which made support work
 * impractical and meant a stray click could edit the wrong tenant's data. The
 * empty result is a prompt to choose, surfaced in the UI by a banner, not an
 * error.
 *
 * `getAllAreaIds` is therefore no longer reachable from here. It is kept as an
 * export because the import script and area-management tooling legitimately
 * want every area.
 *
 * RLS remains the enforcement boundary — this narrows, it does not authorize.
 */
export async function getAccessibleAreaIds(
  supabase: SupabaseClient,
  _isAdmin: boolean,
  customerId: string | null
): Promise<string[]> {
  if (customerId) {
    return getCustomerAreaIds(supabase, customerId);
  }
  return [];
}
