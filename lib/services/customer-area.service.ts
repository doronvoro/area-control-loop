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
 * Get accessible area IDs based on role.
 * Admin → all areas, non-admin → customer's areas only.
 */
export async function getAccessibleAreaIds(
  supabase: SupabaseClient,
  isAdmin: boolean,
  customerId: string | null
): Promise<string[]> {
  if (isAdmin) {
    return getAllAreaIds(supabase);
  }
  if (customerId) {
    return getCustomerAreaIds(supabase, customerId);
  }
  return [];
}
