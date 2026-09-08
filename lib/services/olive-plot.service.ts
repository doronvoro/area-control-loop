import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Olive plots.
 *
 * A plot IS an `areas` row — that table already carries name, variety,
 * planting_time, size, crop_id and geometry. olive_plot_details holds only the
 * olive-specific fields alongside it, and takts are the plot's sub_areas.
 */

// --- Types ---

export interface OlivePlotDetailsInput {
  grower_name?: string | null;
  region?: string | null;
  plot_type?: string | null;
  harvester?: string | null;
  water_type?: string | null;
  takt_count?: number | null;
  plant_year_label?: string | null;
}

// --- Public API ---

/**
 * Plots for the given areas, with their olive details and takts.
 *
 * Callers pass the area ids they are allowed to see (getAccessibleAreaIds),
 * so scoping stays in one place. RLS is still the real boundary.
 */
export async function getOlivePlots(supabase: SupabaseClient, areaIds: string[]): Promise<any[]> {
  if (areaIds.length === 0) return [];

  const { data, error } = await (supabase.from('areas') as any)
    .select(
      `*,
      crops(*),
      details:olive_plot_details(*),
      takts:sub_areas(id, name, level, parent_sub_area_id)`
    )
    .in('id', areaIds)
    .order('name', { ascending: true });

  if (error) throw error;

  // olive_plot_details is 1:1, but PostgREST returns an array for an embedded
  // child. Flatten it so callers and lib/olive/logic.ts see a plain object.
  return (data || []).map((area: any) => ({
    ...area,
    details: Array.isArray(area.details) ? (area.details[0] ?? null) : (area.details ?? null),
  }));
}

/** One plot with its details and takts, or null when it does not exist. */
export async function getOlivePlot(supabase: SupabaseClient, areaId: string): Promise<any | null> {
  const plots = await getOlivePlots(supabase, [areaId]);
  return plots[0] ?? null;
}

/**
 * Create or replace the olive details for a plot.
 *
 * area_id is the primary key, so a plain upsert is enough — there is exactly
 * one details row per plot and no sequence to collide on.
 */
export async function upsertOlivePlotDetails(
  adminClient: SupabaseClient,
  areaId: string,
  details: OlivePlotDetailsInput
): Promise<any> {
  const { data, error } = await (adminClient.from('olive_plot_details') as any)
    .upsert(
      {
        area_id: areaId,
        grower_name: details.grower_name ?? null,
        region: details.region ?? null,
        plot_type: details.plot_type ?? null,
        harvester: details.harvester ?? null,
        water_type: details.water_type ?? null,
        takt_count: details.takt_count ?? null,
        plant_year_label: details.plant_year_label ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'area_id' }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Area ids that have been fully harvested for a season.
 *
 * A plot leaves the active list once a harvest report is marked `is_final`,
 * which replaces the prototype's single boolean flag on the plot itself.
 */
export async function getHarvestedAreaIds(
  supabase: SupabaseClient,
  areaIds: string[]
): Promise<string[]> {
  if (areaIds.length === 0) return [];

  const { data, error } = await (supabase.from('harvest_report') as any)
    .select('report_area:report_areas!inner(area_id)')
    .eq('is_final', true);

  if (error) throw error;

  const harvested = new Set<string>(
    (data || [])
      .map((row: any) => row.report_area?.area_id)
      .filter((id: string | undefined): id is string => Boolean(id))
  );

  return areaIds.filter((id) => harvested.has(id));
}
