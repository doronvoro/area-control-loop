import type { SupabaseClient } from '@supabase/supabase-js';
import { findOrCreateReportArea } from '@/lib/api/utils';
import { AreaTypeId } from '@/types/database';

/**
 * Harvest passes (מסיק).
 *
 * A pass is a `report_areas` row of type 'harvest' plus a 1:1 `harvest_report`
 * detail row. A plot is normally harvested over several passes; the one marked
 * `is_final` retires the plot for the season, replacing the prototype's single
 * boolean flag.
 */

// --- Types ---

export interface HarvestValuesInput {
  sub_area_id?: string | null;
  pass_number?: number;
  harvester_type?: string | null;
  operator?: string | null;
  area_done_dunam?: number | null;
  fruit_kg?: number | null;
  oil_kg?: number | null;
  is_final?: boolean;
}

export interface CreateHarvestParams extends HarvestValuesInput {
  areaId: string;
  workerId?: string;
  reportDate?: string;
  notes?: string | null;
}

const HARVEST_SELECT = `
  id, name, description, status, report_number, report_date, created_at, area_type_id,
  area:areas(id, name, variety, size),
  worker:workers(id, name),
  detail:harvest_report(*)
`;

// --- Private helpers ---

function harvestRow(values: HarvestValuesInput): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  const keys: (keyof HarvestValuesInput)[] = [
    'sub_area_id',
    'pass_number',
    'harvester_type',
    'operator',
    'area_done_dunam',
    'fruit_kg',
    'oil_kg',
    'is_final',
  ];
  for (const key of keys) {
    if (values[key] !== undefined) row[key] = values[key];
  }
  return row;
}

function flattenDetail(row: any) {
  if (!row) return row;
  return {
    ...row,
    detail: Array.isArray(row.detail) ? (row.detail[0] ?? null) : (row.detail ?? null),
  };
}

// --- Public API ---

/**
 * Next pass number for a plot: one past the highest recorded so far.
 *
 * Derived rather than supplied so a second pass cannot silently reuse number 1
 * and corrupt the season total.
 */
export async function getNextPassNumber(supabase: SupabaseClient, areaId: string): Promise<number> {
  const { data, error } = await (supabase.from('harvest_report') as any)
    .select('pass_number, report_area:report_areas!inner(area_id)')
    .eq('report_area.area_id', areaId)
    .order('pass_number', { ascending: false })
    .limit(1);

  if (error) throw error;

  const highest = (data || [])[0]?.pass_number;
  return (Number(highest) || 0) + 1;
}

export async function createHarvestReport(
  supabase: SupabaseClient,
  adminClient: SupabaseClient,
  params: CreateHarvestParams
): Promise<any> {
  const { areaId, workerId, reportDate, notes, ...values } = params;

  if (!areaId) throw new Error('areaId is required');

  const passNumber = values.pass_number ?? (await getNextPassNumber(supabase, areaId));

  const reportAreaId = await findOrCreateReportArea(
    supabase,
    adminClient,
    areaId,
    AreaTypeId.HARVEST,
    {
      reuseExisting: false,
      workerId,
      reportDate,
      namePrefix: `מסיק מעבר ${passNumber}`,
      description: notes || 'דוח מסיק',
    }
  );

  const { data, error } = await (adminClient.from('harvest_report') as any)
    .insert({
      report_area_id: reportAreaId,
      ...harvestRow(values),
      pass_number: passNumber,
    })
    .select()
    .single();

  if (error) throw error;

  await (adminClient.from('report_areas') as any)
    .update({ status: 'completed', completion_percentage: 100 })
    .eq('id', reportAreaId);

  return { report_area_id: reportAreaId, detail: data };
}

export async function updateHarvestReport(
  adminClient: SupabaseClient,
  reportAreaId: string,
  values: HarvestValuesInput & { reportDate?: string; notes?: string | null }
): Promise<any> {
  const { reportDate, notes, ...detail } = values;

  const { data, error } = await (adminClient.from('harvest_report') as any)
    .update({ ...harvestRow(detail), updated_at: new Date().toISOString() })
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

export async function deleteHarvestReport(
  adminClient: SupabaseClient,
  reportAreaId: string
): Promise<void> {
  const { error } = await (adminClient.from('report_areas') as any)
    .delete()
    .eq('id', reportAreaId)
    .eq('area_type_id', AreaTypeId.HARVEST);

  if (error) throw error;
}

export async function getHarvestReports(
  supabase: SupabaseClient,
  areaIds: string[]
): Promise<any[]> {
  if (areaIds.length === 0) return [];

  const { data, error } = await (supabase.from('report_areas') as any)
    .select(HARVEST_SELECT)
    .eq('area_type_id', AreaTypeId.HARVEST)
    .in('area_id', areaIds)
    .order('report_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(flattenDetail);
}
