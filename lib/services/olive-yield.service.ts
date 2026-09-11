import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Per-season yield estimates.
 *
 * kg/dunam drives the "עומס יבול" band on a plot card (spec §4.3). Total fruit
 * is deliberately not stored: it is kg_per_dunam x areas.size, computed on read,
 * so the two can never drift apart.
 */

// --- Types ---

export interface UpsertYieldParams {
  areaId: string;
  seasonId: string;
  kgPerDunam: number | null;
}

// --- Public API ---

/** Estimates for a season, keyed by area id for direct lookup from a plot row. */
export async function getYieldEstimatesBySeason(
  supabase: SupabaseClient,
  seasonId: string,
  areaIds: string[]
): Promise<Record<string, any>> {
  if (areaIds.length === 0) return {};

  const { data, error } = await supabase
    .from('yield_estimates')
    .select('*')
    .eq('season_id', seasonId)
    .in('area_id', areaIds);

  if (error) throw error;

  const byArea: Record<string, any> = {};
  for (const row of data || []) {
    byArea[(row as any).area_id] = row;
  }
  return byArea;
}

/**
 * Create or update one estimate.
 *
 * (area_id, season_id) is unique, so this upserts on that pair rather than on
 * the surrogate id — a caller editing a cell in the yield table has no id.
 */
export async function upsertYieldEstimate(
  adminClient: SupabaseClient,
  params: UpsertYieldParams
): Promise<any> {
  const { data, error } = await (adminClient.from('yield_estimates') as any)
    .upsert(
      {
        area_id: params.areaId,
        season_id: params.seasonId,
        kg_per_dunam: params.kgPerDunam,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'area_id,season_id' }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Actual harvested totals per area for a season, summed across passes.
 *
 * Read from harvest_report rather than stored on the plot, so a plot harvested
 * in three passes reports one total without anyone maintaining a running sum.
 */
export async function getHarvestTotalsByArea(
  supabase: SupabaseClient,
  areaIds: string[]
): Promise<Record<string, { fruitKg: number; oilKg: number; passes: number }>> {
  if (areaIds.length === 0) return {};

  const { data, error } = await (supabase.from('harvest_report') as any).select(
    'fruit_kg, oil_kg, report_area:report_areas!inner(area_id)'
  );

  if (error) throw error;

  const allowed = new Set(areaIds);
  const totals: Record<string, { fruitKg: number; oilKg: number; passes: number }> = {};

  for (const row of data || []) {
    const areaId = (row as any).report_area?.area_id;
    if (!areaId || !allowed.has(areaId)) continue;

    if (!totals[areaId]) totals[areaId] = { fruitKg: 0, oilKg: 0, passes: 0 };
    totals[areaId].fruitKg += Number((row as any).fruit_kg) || 0;
    totals[areaId].oilKg += Number((row as any).oil_kg) || 0;
    totals[areaId].passes += 1;
  }

  return totals;
}
