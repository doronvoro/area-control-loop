import type { SupabaseClient } from '@supabase/supabase-js';
import { toCategoryColumns, toWeatherColumns, type AlertBoundUpdate } from '@/lib/olive/thresholds';
import { isMissingTableError } from '@/lib/supabase/errors';
import type { CategoryThresholds, WeatherThresholds } from '@/lib/olive/logic';

/**
 * Olive configuration lookups: measurement parameters, their threshold rules,
 * seasons, and per-variety harvest windows.
 *
 * These are the rows that keep harvest thresholds out of application code —
 * lib/olive/logic.ts consumes parameter_rules rather than constants.
 */

// --- Types ---

export interface UpsertSeasonParams {
  id?: string;
  name: string;
  yearType?: string | null;
  startsOn: string;
  endsOn: string;
  isActive?: boolean;
}

// --- Public API ---

/** All measurement parameters, in display order. */
export async function getParameters(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('parameters')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * All threshold rules, ordered so evaluateParameter's first-match-wins scan is
 * correct even if a caller forgets to sort.
 */
export async function getParameterRules(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('parameter_rules')
    .select('*')
    .order('parameter_code', { ascending: true })
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * The status-card bands, or null when the seed row is missing.
 *
 * Single row by construction (plot_category_thresholds.id is CHECKed to
 * 'default'), so maybeSingle() cannot be ambiguous. Callers hand the result to
 * toCategoryThresholds(), which supplies the prototype defaults for a null.
 */
export async function getCategoryThresholds(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('plot_category_thresholds')
    .select('*')
    .eq('id', 'default')
    .maybeSingle();

  // Merging deploys this code through Vercel while production schema is applied
  // by hand afterwards (docs/rollout/README.md), so there is a window where the
  // table is not there yet. toCategoryThresholds turns a null into the same
  // defaults the table is seeded with, which keeps the dashboard up; throwing
  // would 500 the entire payload over a config row. isMissingTableError knows
  // which code that window actually produces — PGRST205, not 42P01.
  if (isMissingTableError(error)) return null;
  if (error) throw error;
  return data || null;
}

/**
 * Write the status-card bands.
 *
 * Upsert rather than update: on a database where the rollout SQL has run but
 * the row was lost (a TRUNCATE, a partial restore) this recreates it, and
 * plot_category_thresholds.id is CHECKed to 'default', so ON CONFLICT (id) can
 * never be ambiguous — the migration makes that the contract. Same shape the
 * backup importer uses, so there is exactly one way this row gets written.
 *
 * GLOBAL: no customer_id. This changes the dashboard for every tenant, the
 * reach variety_windows and weather_days already have.
 *
 * Callers MUST validate with parseCategoryThresholds() first. Every column
 * carries a CHECK, and handleApiError would hand a violation to the operator as
 * a raw 500 in English.
 */
export async function upsertCategoryThresholds(
  adminClient: SupabaseClient,
  bands: CategoryThresholds
): Promise<any> {
  const { data, error } = await (adminClient.from('plot_category_thresholds') as any)
    .upsert(
      { id: 'default', ...toCategoryColumns(bands), updated_at: new Date().toISOString() },
      { onConflict: 'id' }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * The forecast alert levels, or null when the seed row is missing.
 *
 * Same singleton construction and the same missing-table tolerance as
 * getCategoryThresholds above — and the same reason for it: this table is newer
 * than the deploy that reads it, and toWeatherThresholds() turns a null into the
 * values the flags shipped with, so the strip and every urgency headline stay
 * correct while the rollout SQL is still waiting to be pasted.
 */
export async function getWeatherThresholds(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('weather_alert_thresholds')
    .select('*')
    .eq('id', 'default')
    .maybeSingle();

  if (isMissingTableError(error)) return null;
  if (error) throw error;
  return data || null;
}

/**
 * Write the forecast alert levels.
 *
 * Upsert for the same reason as upsertCategoryThresholds: id is CHECKed to
 * 'default', so ON CONFLICT (id) cannot be ambiguous and a lost row is
 * recreated rather than silently not written.
 *
 * GLOBAL: no customer_id. Weather is regional — weather_days has no customer_id
 * either — so there is nothing per-tenant for these levels to vary against.
 *
 * Callers MUST validate with parseWeatherThresholds() first; both columns carry
 * a CHECK.
 */
export async function upsertWeatherThresholds(
  adminClient: SupabaseClient,
  levels: WeatherThresholds
): Promise<any> {
  const { data, error } = await (adminClient.from('weather_alert_thresholds') as any)
    .upsert(
      { id: 'default', ...toWeatherColumns(levels), updated_at: new Date().toISOString() },
      { onConflict: 'id' }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Change ONLY `upper_bound`, only on the rule rows the caller names.
 *
 * Never inserts, deletes, reorders, or touches status / severity / message /
 * upper_inclusive. That is the whole reason the alert editor is safe to expose:
 * the cascade's shape and idx_parameter_rules_order are never in play, so no
 * edit can leave parameter_rules in a state evaluateParameter cannot read.
 *
 * Reads first, then updates by primary key. The read costs one query and buys
 * three things an update-by-(parameter_code, sort_order) would not have: a
 * single-row target that does not lean on the unique index, a diff so an
 * unchanged bound issues no write at all, and a real error when a rule row is
 * missing instead of a silent no-op.
 *
 * PARTIAL FAILURE IS TOLERATED ON PURPOSE. The writes run in order, one at a
 * time — never Promise.all, which would make a failure unordered as well as
 * partial. Because validation ran over the complete set first and only a
 * numeric bound is ever written, a failure halfway leaves the cascade
 * well-formed: correctly ordered, no gaps, no NULL introduced, one bound simply
 * still the old number. And because the operation is a diff, retrying re-reads,
 * skips what already landed, and converges exactly. Do not "fix" this into a
 * batch.
 *
 * Returns the number of rows actually changed.
 */
export async function updateParameterRuleBounds(
  adminClient: SupabaseClient,
  updates: AlertBoundUpdate[]
): Promise<number> {
  const { data: rows, error } = await adminClient
    .from('parameter_rules')
    .select('id, parameter_code, sort_order, upper_bound');
  if (error) throw error;

  let changed = 0;

  for (const update of updates) {
    const row = ((rows || []) as any[]).find(
      (r) => r.parameter_code === update.parameterCode && r.sort_order === update.sortOrder
    );

    if (!row) {
      throw new Error(`כלל סף חסר במסד הנתונים: ${update.parameterCode} #${update.sortOrder}`);
    }

    // A NULL bound is the cascade's catch-all. Reaching one here means the
    // stored sort_order no longer matches ALERT_BAND_FIELDS, and writing a
    // bound into it would drop the last band of that parameter entirely.
    if (row.upper_bound === null) {
      throw new Error(
        `כלל הסף ${update.parameterCode} #${update.sortOrder} הוא כלל ברירת מחדל ואינו ניתן לעריכה`
      );
    }

    // upper_bound is NUMERIC, so it arrives as a string — Number() or the diff
    // never matches and every bound is rewritten on every save.
    if (Number(row.upper_bound) === update.upperBound) continue;

    const { error: updateError } = await (adminClient.from('parameter_rules') as any)
      .update({ upper_bound: update.upperBound, updated_at: new Date().toISOString() })
      .eq('id', row.id);
    if (updateError) throw updateError;

    changed += 1;
  }

  return changed;
}

export async function getSeasons(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('seasons')
    .select('*')
    .order('starts_on', { ascending: false });

  if (error) throw error;
  return data || [];
}

/** The season currently marked active, or null when none is. */
export async function getActiveSeason(supabase: SupabaseClient) {
  const { data } = await supabase.from('seasons').select('*').eq('is_active', true).maybeSingle();

  return data || null;
}

/**
 * Create or update a season.
 *
 * Activating one season deactivates the others, so `is_active` stays a
 * single-winner flag without needing a partial unique index that would make
 * ordinary updates awkward.
 */
export async function upsertSeason(
  adminClient: SupabaseClient,
  params: UpsertSeasonParams
): Promise<any> {
  const row = {
    name: params.name,
    year_type: params.yearType ?? null,
    starts_on: params.startsOn,
    ends_on: params.endsOn,
    is_active: params.isActive ?? false,
    updated_at: new Date().toISOString(),
  };

  const query = params.id
    ? (adminClient.from('seasons') as any).update(row).eq('id', params.id)
    : (adminClient.from('seasons') as any).insert(row);

  const { data, error } = await query.select().single();
  if (error) throw error;

  if (row.is_active) {
    await (adminClient.from('seasons') as any).update({ is_active: false }).neq('id', data.id);
  }

  return data;
}

export async function getVarietyWindows(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from('variety_windows')
    .select('*')
    .order('variety', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createVarietyWindow(
  adminClient: SupabaseClient,
  params: { variety: string; startDm: string; endDm: string }
): Promise<any> {
  const { data, error } = await (adminClient.from('variety_windows') as any)
    .insert({
      variety: params.variety,
      start_dm: params.startDm,
      end_dm: params.endDm,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteVarietyWindow(adminClient: SupabaseClient, id: string): Promise<void> {
  const { error } = await (adminClient.from('variety_windows') as any).delete().eq('id', id);
  if (error) throw error;
}
