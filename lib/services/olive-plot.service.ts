import type { SupabaseClient } from '@supabase/supabase-js';
import { OLIVE_CROP_NAME, taktName } from '@/lib/olive/constants';

/**
 * Olive plots.
 *
 * A plot IS an `areas` row — that table already carries name, variety,
 * planting_time, size, crop_id and geometry. olive_plot_details holds only the
 * olive-specific fields alongside it, and takts are the plot's sub_areas.
 */

// --- Types ---

export interface OlivePlotDetailsInput {
  /**
   * The grower, when one was picked from the list.
   *
   * grower_name is what the importer and the plots table read, and the two are
   * kept in step by trg_olive_plot_details_resolve_grower: an id wins and the
   * name follows it, a name with no id resolves (or creates) the grower. So a
   * caller may send either — and must not have to send both.
   */
  grower_id?: string | null;
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

  // !inner + the crop filter is what keeps this to olive plots. Without it the
  // caller's other areas — tomato, apple, whatever else the customer grows —
  // would appear in olive plot pickers and be counted on the harvest dashboard.
  const { data, error } = await (supabase.from('areas') as any)
    .select(
      `*,
      crops!inner(*),
      details:olive_plot_details(*),
      takts:sub_areas(id, name, level, parent_sub_area_id)`
    )
    .in('id', areaIds)
    .eq('crops.name', OLIVE_CROP_NAME)
    .order('name', { ascending: true });

  if (error) throw error;

  // olive_plot_details is 1:1, but PostgREST returns an array for an embedded
  // child. Flatten it so callers and lib/olive/logic.ts see a plain object.
  return (data || []).map((area: any) => ({
    ...area,
    details: Array.isArray(area.details) ? (area.details[0] ?? null) : (area.details ?? null),
  }));
}

/**
 * Narrow a set of accessible area ids to the olive ones.
 *
 * Routes use this before writing, so a NIR measurement or harvest report can
 * never be attached to a non-olive area even though the caller can legitimately
 * access it for pest monitoring.
 */
export async function getOliveAreaIds(
  supabase: SupabaseClient,
  areaIds: string[]
): Promise<string[]> {
  if (areaIds.length === 0) return [];

  const { data, error } = await (supabase.from('areas') as any)
    .select('id, crops!inner(name)')
    .in('id', areaIds)
    .eq('crops.name', OLIVE_CROP_NAME);

  if (error) throw error;
  return (data || []).map((row: any) => row.id);
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
        grower_id: details.grower_id ?? null,
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
 * The זית crop's id.
 *
 * Every olive read filters on the crop NAME through a join; a write has to
 * resolve it to an id first. Throws the same Hebrew error the importer throws,
 * because the cause and the fix are identical: the crop is created out of band
 * by docs/rollout/04-create-crop.sql, not by a migration.
 */
export async function getOliveCropId(supabase: SupabaseClient): Promise<string> {
  const { data, error } = await (supabase.from('crops') as any)
    .select('id')
    .eq('name', OLIVE_CROP_NAME)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error(`לא קיים גידול בשם "${OLIVE_CROP_NAME}". יש ליצור אותו לפני הוספת חלקות.`);
  }
  return (data as { id: string }).id;
}

export interface CreateOlivePlotInput {
  customerId: string;
  cropId: string;
  name: string;
  description?: string | null;
  variety?: string | null;
  size?: number | null;
  plantingTime?: string | null;
  details?: OlivePlotDetailsInput;
  /** 1..MAX_TAKT_COUNT sub_areas to create. Null or 0 creates none. */
  taktCount?: number | null;
}

/**
 * Create an olive plot: the areas row, the tenancy link, the olive details and
 * the takts.
 *
 * The recipe is the one lib/olive/import-backup.ts already performs per plot,
 * lifted here so a single plot can be created from the UI. The importer is
 * deliberately NOT rewired to call this: its version is interleaved with dry-run
 * bookkeeping, name-based reuse and takt adoption, so a shared abstraction would
 * have to carry `apply` and the issue reporter — which is how a service turns
 * into a second importer. taktName() is shared instead, because that is the one
 * piece that must never disagree.
 *
 * NO TRANSACTION IS AVAILABLE. PostgREST is one statement per request, so the
 * write ORDER encodes the failure policy:
 *
 *   1-2. areas + customer_areas are a hand-rolled atomic pair. An area with no
 *        customer_areas row is invisible to every non-admin path in the app —
 *        no screen can find it and nothing can delete it — so a failed link
 *        rolls the area back rather than leaving that behind.
 *   3-4. olive_plot_details and the takts degrade to warnings. By then the plot
 *        exists, is linked and appears in the grid, and every field they write
 *        is editable in the plot drawer. Deleting a plot the caller can already
 *        see, to undo an optional write, would be worse than saying so.
 */
export async function createOlivePlot(
  adminClient: SupabaseClient,
  input: CreateOlivePlotInput
): Promise<{ areaId: string; warnings: string[] }> {
  const warnings: string[] = [];

  // 1. The plot itself. Same column set as the importer's insert.
  const { data: area, error: areaError } = await (adminClient.from('areas') as any)
    .insert({
      name: input.name,
      description: input.description ?? null,
      crop_id: input.cropId,
      size: input.size ?? null,
      size_unit_type: 'dunam',
      area_type: 'outdoor',
      variety: input.variety ?? null,
      planting_time: input.plantingTime ?? null,
    })
    .select('id')
    .single();

  if (areaError) throw areaError;
  const areaId = (area as { id: string }).id;

  // 2. Tenancy. customer_areas is the ONLY thing that makes this plot reachable.
  const { error: linkError } = await (adminClient.from('customer_areas') as any).insert({
    customer_id: input.customerId,
    area_id: areaId,
  });

  if (linkError) {
    await rollbackArea(adminClient, areaId);
    throw linkError;
  }

  // 3. Olive-specific attributes.
  if (input.details) {
    try {
      await upsertOlivePlotDetails(adminClient, areaId, input.details);
    } catch {
      warnings.push('החלקה נוצרה, אך שמירת פרטי הזית נכשלה. ניתן להשלים אותם בכרטיס החלקה.');
    }
  }

  // 4. Takts. Without these the plot claims N takts while every NIR and harvest
  //    picker says "אין טאקטים בחלקה זו" — and nothing else in the app creates
  //    them, so if this does not, nothing will.
  const taktCount = input.taktCount ?? 0;
  if (taktCount > 0) {
    const { error: taktError } = await (adminClient.from('sub_areas') as any).insert(
      Array.from({ length: taktCount }, (_, i) => ({
        area_id: areaId,
        name: taktName(i + 1),
        level: 1,
        variety: input.variety ?? null,
      }))
    );

    if (taktError) {
      warnings.push('החלקה נוצרה, אך יצירת הטאקטים נכשלה. ניתן להוסיף אותם במסך השטחים.');
    }
  }

  return { areaId, warnings };
}

/**
 * Best-effort cleanup of a plot whose tenancy link failed.
 *
 * customer_areas, sub_areas and olive_plot_details all cascade from areas, so
 * deleting the area is enough. Its own failure is swallowed deliberately, for
 * the reason rollbackUser in lib/api/utils.ts already documents: the caller is
 * already throwing the error that matters, and "rollback failed" would hide the
 * cause. An orphaned area is recoverable from /admin/areas-management; a
 * misleading error is not.
 */
async function rollbackArea(adminClient: SupabaseClient, areaId: string): Promise<void> {
  try {
    await (adminClient.from('areas') as any).delete().eq('id', areaId);
  } catch {
    // Intentionally ignored — see above.
  }
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
