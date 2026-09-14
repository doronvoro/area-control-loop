/**
 * Remove one tenant's imported olive data, so a corrected backup can replace it.
 *
 * WHY THIS EXISTS
 * importBackup() is idempotent for plots (matched by name), NIR (deduped on
 * area+date), yield and plot details (upserts) and takts (adopted by name) —
 * but NOT for harvest reports, which it inserts unconditionally. Re-importing
 * without a wipe prints a reassuring "45 matched" while quietly doubling the
 * harvest history. That is the defect this exists to prevent.
 *
 * SCOPE
 * The tenant's areas whose crop is זית, and everything cascading off them.
 * Crop-scoped rather than tenant-wide on purpose: tenants here are not
 * single-crop — one holds 11 areas across 6 crops including olive — so a
 * blanket per-tenant delete aimed at the wrong customer would take their
 * apples and tomatoes with it.
 *
 * NOT TOUCHED: the customers row, its workers and logins; any non-olive area;
 * and the shared seasons / variety_windows / weather_days tables, which carry
 * no customer_id and are read by every tenant. Deleting a season in particular
 * would cascade through yield_estimates.season_id and wipe estimates for
 * everyone.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { OLIVE_CROP_NAME } from '@/lib/olive/constants';

export interface WipeCounts {
  areas: number;
  subAreas: number;
  reportAreas: number;
  plotDetails: number;
  yieldEstimates: number;
}

/**
 * More olive plots than any real tenant has. A larger target set means the
 * customer id is probably not the one the operator thought they picked.
 */
const MAX_AREAS = 500;

/** Count rows matching a column-in-list filter, without fetching them. */
async function countIn(
  supabase: SupabaseClient,
  table: string,
  column: string,
  ids: string[]
): Promise<number> {
  const { count, error } = await (supabase.from(table) as any)
    .select('*', { count: 'exact', head: true })
    .in(column, ids);
  if (error) throw error;
  return count ?? 0;
}

export async function wipeCustomerOliveData(
  supabase: SupabaseClient,
  customerId: string,
  opts: { apply: boolean }
): Promise<WipeCounts> {
  const empty: WipeCounts = {
    areas: 0,
    subAreas: 0,
    reportAreas: 0,
    plotDetails: 0,
    yieldEstimates: 0,
  };

  const { data: crop, error: cropError } = await supabase
    .from('crops')
    .select('id')
    .eq('name', OLIVE_CROP_NAME)
    .maybeSingle();
  if (cropError) throw cropError;
  if (!crop) throw new Error(`No crop named "${OLIVE_CROP_NAME}".`);
  const cropId = (crop as any).id;

  // The tenant's olive areas. areas has no customer_id — tenancy is only the
  // customer_areas junction — so the link table is the only way in.
  const { data: links, error: linkError } = await supabase
    .from('customer_areas')
    .select('area_id, areas!inner(id, crop_id)')
    .eq('customer_id', customerId)
    .eq('areas.crop_id', cropId);
  if (linkError) throw linkError;

  const areaIds = [...new Set(((links || []) as any[]).map((l) => l.area_id))];
  if (areaIds.length === 0) return empty;

  if (areaIds.length > MAX_AREAS) {
    throw new Error(
      `Refusing to delete ${areaIds.length} olive areas for this customer — more than the ${MAX_AREAS} ceiling. Check the customer before continuing.`
    );
  }

  // customer_areas is UNIQUE(customer_id, area_id), not UNIQUE(area_id), so an
  // area can be linked to two tenants at once — supabase/seed/olive_demo_seed.sql
  // cross-joins every customer onto every olive area and produces exactly that.
  // Deleting such an area destroys it for the other tenant, so stop rather than
  // silently unlink.
  const { data: shared, error: sharedError } = await supabase
    .from('customer_areas')
    .select('area_id, customer_id, areas(name)')
    .in('area_id', areaIds)
    .neq('customer_id', customerId);
  if (sharedError) throw sharedError;

  if (shared && shared.length > 0) {
    const names = (shared as any[])
      .map((s) => s.areas?.name ?? s.area_id)
      .slice(0, 10)
      .join(', ');
    throw new Error(
      `Refusing to delete: ${shared.length} of these areas are also linked to another customer (${names}). ` +
        'Deleting them would remove those areas from the other tenant too. Unlink them first.'
    );
  }

  const counts: WipeCounts = {
    areas: areaIds.length,
    subAreas: await countIn(supabase, 'sub_areas', 'area_id', areaIds),
    reportAreas: await countIn(supabase, 'report_areas', 'area_id', areaIds),
    plotDetails: await countIn(supabase, 'olive_plot_details', 'area_id', areaIds),
    yieldEstimates: await countIn(supabase, 'yield_estimates', 'area_id', areaIds),
  };

  if (!opts.apply) return counts;

  // report_areas first. It IS ON DELETE CASCADE from areas in this repo, but
  // production's schema has diverged from the migrations (docs/rollout/README.md),
  // and docs/rollout/03-rollback.sql deletes it explicitly for the same reason.
  // Deleting it up front costs one statement and removes the assumption.
  const { error: reportError } = await supabase
    .from('report_areas')
    .delete()
    .in('area_id', areaIds);
  if (reportError) throw reportError;

  // areas cascades to customer_areas, sub_areas, olive_plot_details,
  // yield_estimates, and — through report_areas — nir_report and harvest_report.
  const { error: areaError } = await supabase.from('areas').delete().in('id', areaIds);
  if (areaError) throw areaError;

  return counts;
}
