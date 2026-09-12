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
 * The `isAdmin` case is now only the fallback for an admin with no customer
 * selected. Phase 5 of the tenant-switcher work replaces it with `[]`, so that
 * an admin sees nothing until they choose; it is kept for now so the switcher
 * can land without changing what anyone currently sees.
 *
 * RLS remains the enforcement boundary — this narrows, it does not authorize.
 */
export async function getAccessibleAreaIds(
  supabase: SupabaseClient,
  isAdmin: boolean,
  customerId: string | null
): Promise<string[]> {
  if (customerId) {
    return getCustomerAreaIds(supabase, customerId);
  }
  if (isAdmin) {
    return getAllAreaIds(supabase);
  }
  return [];
}
