import type { SupabaseClient } from '@supabase/supabase-js';
import { getAccessibleAreaIds } from '@/lib/services/customer-area.service';
import { OLIVE_CROP_NAME } from '@/lib/olive/constants';

/**
 * Does this scope have any olive areas?
 *
 * Gating the olive module on crop rather than on a customer id means the next
 * olive grower needs no code change. This only decides what is shown and where
 * `/` lands — page-level requireAuth and RLS remain the actual enforcement.
 *
 * Takes the pieces rather than an ApiContext so the root landing page can ask
 * without constructing a service-role client it has no use for.
 */
export async function hasOliveAreas(
  supabase: SupabaseClient,
  isAdmin: boolean,
  customerId: string | null
): Promise<boolean> {
  const areaIds = await getAccessibleAreaIds(supabase, isAdmin, customerId);
  if (areaIds.length === 0) return false;

  const { data } = await (supabase.from('areas') as any)
    .select('id, crops!inner(name)')
    .in('id', areaIds)
    .eq('crops.name', OLIVE_CROP_NAME)
    .limit(1);

  return (data || []).length > 0;
}
