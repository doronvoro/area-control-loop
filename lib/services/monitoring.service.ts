import type { SupabaseClient } from '@supabase/supabase-js';
import { findOrCreateReportArea } from '@/lib/api/utils';
import { createMonitoringTreatments, EntryWithTreatments } from './treatment.service';
import { AreaTypeId, ReportSeverity } from '@/types/database';

// --- Types ---

export interface MonitoringEntryInput extends EntryWithTreatments {
  sub_area_id?: string | null;
  sub_area_ids?: (string | null)[];
  finding_id: string;
  severity?: ReportSeverity | null;
}

export interface CreateMonitoringBatchParams {
  areaId: string;
  workerId?: string;
  entries: MonitoringEntryInput[];
}

export interface CreateMonitoringSingleParams {
  areaReportId?: string;
  areaId?: string;
  workerId?: string;
  entry: MonitoringEntryInput;
}

// --- Private helpers ---

function expandEntries(entries: MonitoringEntryInput[]): (MonitoringEntryInput & { sub_area_id: string | null })[] {
  const expanded: (MonitoringEntryInput & { sub_area_id: string | null })[] = [];
  for (const entry of entries) {
    const subAreaIds = entry.sub_area_ids || (entry.sub_area_id !== undefined ? [entry.sub_area_id] : []);
    if (subAreaIds.length === 0) continue;

    for (const subAreaId of subAreaIds) {
      expanded.push({
        ...entry,
        sub_area_id: subAreaId ?? null,
        sub_area_ids: undefined,
      });
    }
  }
  return expanded;
}

async function insertMonitoringReport(
  adminClient: SupabaseClient,
  reportAreaId: string,
  entry: MonitoringEntryInput
) {
  const { data, error } = await adminClient
    .from('monitoring_area_report')
    .insert({
      area_report_id: reportAreaId,
      sub_area_id: entry.sub_area_id,
      finding_id: entry.finding_id,
      severity: entry.severity || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// --- Public API ---

export async function createMonitoringBatch(
  supabase: SupabaseClient,
  adminClient: SupabaseClient,
  params: CreateMonitoringBatchParams
): Promise<{ results: any[]; report_number: number | null; report_area_id: string }> {
  const { areaId, workerId, entries } = params;

  const reportAreaId = await findOrCreateReportArea(
    supabase,
    adminClient,
    areaId,
    AreaTypeId.MONITORING,
    { workerId }
  );

  const expandedEntries = expandEntries(entries);

  const results = [];
  for (const entry of expandedEntries) {
    const monitoringReport = await insertMonitoringReport(adminClient, reportAreaId, entry);
    await createMonitoringTreatments(adminClient, monitoringReport.id, entry);
    results.push(monitoringReport);
  }

  // Fetch report_number from report_areas
  const { data: reportArea } = await adminClient
    .from('report_areas')
    .select('report_number')
    .eq('id', reportAreaId)
    .single();

  return { results, report_number: reportArea?.report_number, report_area_id: reportAreaId };
}

export async function createMonitoringSingle(
  supabase: SupabaseClient,
  adminClient: SupabaseClient,
  params: CreateMonitoringSingleParams
): Promise<any> {
  const { areaReportId, areaId, workerId, entry } = params;

  let finalAreaReportId = areaReportId;

  if (!finalAreaReportId && areaId) {
    finalAreaReportId = await findOrCreateReportArea(
      supabase,
      adminClient,
      areaId,
      AreaTypeId.MONITORING,
      { workerId }
    );
  }

  if (!finalAreaReportId) {
    throw new Error('area_id or area_report_id is required');
  }

  const monitoringReport = await insertMonitoringReport(adminClient, finalAreaReportId, entry);
  await createMonitoringTreatments(adminClient, monitoringReport.id, entry);

  return monitoringReport;
}
