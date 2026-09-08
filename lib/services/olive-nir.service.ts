import type { SupabaseClient } from '@supabase/supabase-js';
import { findOrCreateReportArea } from '@/lib/api/utils';
import { AreaTypeId } from '@/types/database';

/**
 * NIR ripeness measurements.
 *
 * A measurement is a `report_areas` row of type 'nir' plus a 1:1 `nir_report`
 * detail row, so it inherits report numbering, worker attribution and the
 * reports list for free. `dry` is a generated column and is never written.
 */

// --- Types ---

export interface NirValuesInput {
  sub_area_id?: string | null;
  oil?: number | null;
  water?: number | null;
  green?: number | null;
  acid?: number | null;
  maturity?: number | null;
  irrig_amount?: number | null;
  direction?: string | null;
}

export interface CreateNirParams extends NirValuesInput {
  areaId: string;
  workerId?: string;
  reportDate?: string;
  notes?: string | null;
}

const NIR_SELECT = `
  id, name, description, status, report_number, report_date, created_at, area_type_id,
  area:areas(id, name, variety),
  worker:workers(id, name),
  detail:nir_report(*)
`;

// --- Private helpers ---

/** Strip undefined so a partial update never nulls a field the caller omitted. */
function nirRow(values: NirValuesInput): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  const keys: (keyof NirValuesInput)[] = [
    'sub_area_id',
    'oil',
    'water',
    'green',
    'acid',
    'maturity',
    'irrig_amount',
    'direction',
  ];
  for (const key of keys) {
    if (values[key] !== undefined) row[key] = values[key];
  }
  return row;
}

/** Flatten PostgREST's array-shaped 1:1 embed. */
function flattenDetail(row: any) {
  if (!row) return row;
  return {
    ...row,
    detail: Array.isArray(row.detail) ? (row.detail[0] ?? null) : (row.detail ?? null),
  };
}

// --- Public API ---

/**
 * Record one measurement.
 *
 * The report header is created through findOrCreateReportArea so naming, worker
 * and date handling stay identical to monitoring and actions. namePrefix must be
 * passed explicitly: that helper's default branches on MONITORING vs everything
 * else, so omitting it would label NIR reports "דוח פעולה".
 *
 * Status is patched afterwards rather than passed in, to avoid changing a helper
 * shared with the pest-management flows. A measurement is complete the moment it
 * is taken — there is no treatment progress to accumulate, and
 * updateReportStatuses only touches report ids handed to it, so nothing will
 * later recompute these rows.
 */
export async function createNirReport(
  supabase: SupabaseClient,
  adminClient: SupabaseClient,
  params: CreateNirParams
): Promise<any> {
  const { areaId, workerId, reportDate, notes, ...values } = params;

  if (!areaId) throw new Error('areaId is required');

  const reportAreaId = await findOrCreateReportArea(supabase, adminClient, areaId, AreaTypeId.NIR, {
    reuseExisting: false,
    workerId,
    reportDate,
    namePrefix: 'בדיקת NIR',
    description: notes || 'בדיקת NIR',
  });

  const { data, error } = await (adminClient.from('nir_report') as any)
    .insert({ report_area_id: reportAreaId, ...nirRow(values) })
    .select()
    .single();

  if (error) throw error;

  await (adminClient.from('report_areas') as any)
    .update({ status: 'completed', completion_percentage: 100 })
    .eq('id', reportAreaId);

  return { report_area_id: reportAreaId, detail: data };
}

export async function updateNirReport(
  adminClient: SupabaseClient,
  reportAreaId: string,
  values: NirValuesInput & { reportDate?: string; notes?: string | null }
): Promise<any> {
  const { reportDate, notes, ...measurement } = values;

  const { data, error } = await (adminClient.from('nir_report') as any)
    .update({ ...nirRow(measurement), updated_at: new Date().toISOString() })
    .eq('report_area_id', reportAreaId)
    .select()
    .single();

  if (error) throw error;

  if (reportDate !== undefined || notes !== undefined) {
    const header: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (reportDate !== undefined) header.report_date = reportDate;
    if (notes !== undefined) header.description = notes;

    await (adminClient.from('report_areas') as any).update(header).eq('id', reportAreaId);
  }

  return data;
}

/** Deleting the header cascades to the detail row. */
export async function deleteNirReport(
  adminClient: SupabaseClient,
  reportAreaId: string
): Promise<void> {
  const { error } = await (adminClient.from('report_areas') as any)
    .delete()
    .eq('id', reportAreaId)
    .eq('area_type_id', AreaTypeId.NIR);

  if (error) throw error;
}

/** Measurements for the given areas, newest first. */
export async function getNirReports(supabase: SupabaseClient, areaIds: string[]): Promise<any[]> {
  if (areaIds.length === 0) return [];

  const { data, error } = await (supabase.from('report_areas') as any)
    .select(NIR_SELECT)
    .eq('area_type_id', AreaTypeId.NIR)
    .in('area_id', areaIds)
    .order('report_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(flattenDetail);
}

/**
 * The most recent measurement per area, keyed by area id.
 *
 * PostgREST has no DISTINCT ON, so this reduces the ordered list in memory.
 * At ~45 plots sampled through one season that is a few hundred rows; if the
 * archive grows past a season, add a date floor rather than paginating.
 */
export async function getLatestNirByArea(
  supabase: SupabaseClient,
  areaIds: string[]
): Promise<Record<string, any>> {
  const reports = await getNirReports(supabase, areaIds);
  const latest: Record<string, any> = {};

  for (const report of reports) {
    const areaId = report.area?.id;
    if (areaId && !latest[areaId]) latest[areaId] = report;
  }

  return latest;
}
