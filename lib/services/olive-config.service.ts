import type { SupabaseClient } from '@supabase/supabase-js';

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
