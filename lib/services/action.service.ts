import type { SupabaseClient } from '@supabase/supabase-js';
import { findOrCreateReportArea } from '@/lib/api/utils';
import { createActionTreatments } from './treatment.service';
import { updateReportStatuses } from '@/lib/report-status';
import { AreaTypeId } from '@/types/database';

// --- Types ---

export interface ActionEntryInput {
  sub_area_id?: string | null;
  finding_id: string;
  severity?: string | null;
  monitoring_report_id?: string | null;
  treatments?: any[];
  material_id?: string | null;
  dosage?: string | number | null;
  unit_type_id?: string | null;
  action_type_id?: string | null;
  status?: string;
  notes?: string | null;
  action_time?: string | null;
}

export interface CreateActionBatchParams {
  areaId: string;
  workerId?: string;
  reportDate?: string;
  entries: ActionEntryInput[];
}

export interface CreateActionSingleParams {
  areaReportId: string;
  entry: ActionEntryInput;
}

// --- Private helpers ---

async function insertActionReport(
  supabase: SupabaseClient,
  reportAreaId: string,
  entry: ActionEntryInput
) {
  const { data, error } = await supabase
    .from('actions_area_report')
    .insert({
      area_report_id: reportAreaId,
      sub_area_id: entry.sub_area_id,
      finding_id: entry.finding_id,
      severity: entry.severity || null,
    } as any)
    .select()
    .single();

  if (error) throw error;
  return data as any;
}

async function linkMonitoringReport(
  supabase: SupabaseClient,
  monitoringReportId: string,
  actionReportId: string
) {
  const { error } = await (supabase.from('monitoring_area_report') as any)
    .update({ actions_area_report_id: actionReportId })
    .eq('id', monitoringReportId);
  if (error) throw error;
}

async function getMonitoringReportAreaId(
  supabase: SupabaseClient,
  areaId: string
): Promise<string | undefined> {
  const { data } = await (supabase.from('report_areas') as any)
    .select('id')
    .eq('area_id', areaId)
    .eq('area_type_id', AreaTypeId.MONITORING)
    .maybeSingle() as { data: { id: string } | null };
  return data?.id;
}

async function getAreaIdFromReportArea(
  supabase: SupabaseClient,
  reportAreaId: string
): Promise<string | null> {
  const { data } = await (supabase.from('report_areas') as any)
    .select('area_id')
    .eq('id', reportAreaId)
    .single() as { data: { area_id: string } | null };
  return data?.area_id || null;
}

// --- Public API ---

export async function createActionBatch(
  supabase: SupabaseClient,
  adminClient: SupabaseClient,
  params: CreateActionBatchParams
): Promise<any[]> {
  const { areaId, workerId, reportDate, entries } = params;

  const reportAreaId = await findOrCreateReportArea(
    supabase,
    adminClient,
    areaId,
    AreaTypeId.ACTION,
    { reuseExisting: true, workerId, reportDate }
  );

  const results: any[] = [];

  for (const entry of entries) {
    const actionReport = await insertActionReport(supabase, reportAreaId, entry);
    await createActionTreatments(supabase, actionReport.id, entry);

    if (entry.monitoring_report_id) {
      await linkMonitoringReport(supabase, entry.monitoring_report_id, actionReport.id);
    }

    results.push(actionReport);
  }

  // Update statuses
  const monitoringReportIds = entries
    .map((e) => e.monitoring_report_id)
    .filter(Boolean) as string[];
  const actionReportIds = results
    .map((r) => r.id)
    .filter(Boolean) as string[];

  let monitoringReportAreaId: string | undefined;
  if (monitoringReportIds.length > 0) {
    monitoringReportAreaId = await getMonitoringReportAreaId(supabase, areaId);
  }

  await updateReportStatuses(adminClient, {
    monitoringReportIds,
    actionReportIds,
    monitoringReportAreaId,
    actionReportAreaId: reportAreaId,
  });

  return results;
}

export async function createActionSingle(
  supabase: SupabaseClient,
  adminClient: SupabaseClient,
  params: CreateActionSingleParams
): Promise<any> {
  const { areaReportId, entry } = params;

  const actionReport = await insertActionReport(supabase, areaReportId, entry);
  await createActionTreatments(supabase, actionReport.id, entry);

  if (entry.monitoring_report_id) {
    await linkMonitoringReport(supabase, entry.monitoring_report_id, actionReport.id);
  }

  // Update statuses
  const monitoringReportIds = entry.monitoring_report_id ? [entry.monitoring_report_id] : [];
  const actionReportIds = [actionReport.id];

  let monitoringReportAreaId: string | undefined;
  if (monitoringReportIds.length > 0) {
    const areaId = await getAreaIdFromReportArea(supabase, areaReportId);
    if (areaId) {
      monitoringReportAreaId = await getMonitoringReportAreaId(supabase, areaId);
    }
  }

  await updateReportStatuses(adminClient, {
    monitoringReportIds,
    actionReportIds,
    monitoringReportAreaId,
    actionReportAreaId: areaReportId,
  });

  return actionReport;
}
