import { NextResponse } from 'next/server';
import { getApiContext, requireWorkerAdminOrCustomer } from '@/lib/api/auth-context';
import { handleApiError } from '@/lib/api-utils';
import { findOrCreateReportArea, parseDosage } from '@/lib/api/utils';
import { AreaTypeId, ReportSeverity } from '@/types/database';
import { SupabaseClient } from '@supabase/supabase-js';

// Request body types
interface TreatmentInput {
  material_id?: string | null;
  dosage?: string | number | null;
  unit_type_id?: string | null;
  action_type_id?: string | null;
  status?: string;
  notes?: string | null;
}

interface MonitoringEntryInput {
  sub_area_id?: string | null;
  sub_area_ids?: (string | null)[];
  finding_id: string;
  severity?: ReportSeverity | null;
  treatments?: TreatmentInput[];
  // Legacy fields
  material_id?: string | null;
  recommend_material_id?: string | null;
  dosage?: string | number | null;
  recommend_dosage?: string | number | null;
  unit_type_id?: string | null;
  recommend_unit_type_id?: string | null;
  action_type_id?: string | null;
  recommend_action_type_id?: string | null;
}

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

interface BatchRequestBody {
  area_id: string;
  worker_id?: string;
  inspector_id?: string;
  entries: MonitoringEntryInput[];
}

interface SingleRequestBody extends MonitoringEntryInput {
  area_id?: string;
  area_report_id?: string;
  worker_id?: string;
}

type RequestBody = BatchRequestBody | SingleRequestBody;

async function createTreatment(
  adminClient: SupabaseClient,
  monitoringReportId: string,
  treatment: TreatmentInput
): Promise<void> {
  const { error } = await adminClient.from('monitoring_treatments').insert({
    monitoring_report_id: monitoringReportId,
    material_id: treatment.material_id || null,
    dosage: parseDosage(treatment.dosage),
    unit_type_id: treatment.unit_type_id || null,
    action_type_id: treatment.action_type_id || null,
    status: treatment.status || 'pending',
    notes: treatment.notes || null,
  });

  if (error) throw error;
}

async function createTreatmentsFromEntry(
  adminClient: SupabaseClient,
  monitoringReportId: string,
  entry: MonitoringEntryInput
): Promise<void> {
  if (entry.treatments && Array.isArray(entry.treatments)) {
    for (const treatment of entry.treatments) {
      await createTreatment(adminClient, monitoringReportId, treatment);
    }
    return;
  }

  const materialId = entry.material_id || entry.recommend_material_id;
  const actionTypeId = entry.action_type_id || entry.recommend_action_type_id;

  if (materialId || actionTypeId) {
    await createTreatment(adminClient, monitoringReportId, {
      material_id: materialId,
      dosage: entry.dosage || entry.recommend_dosage,
      unit_type_id: entry.unit_type_id || entry.recommend_unit_type_id,
      action_type_id: actionTypeId,
      status: 'pending',
    });
  }
}

async function createMonitoringReport(
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

function isBatchRequest(body: RequestBody): body is BatchRequestBody {
  return 'entries' in body && Array.isArray(body.entries);
}

export async function GET() {
  try {
    const ctx = await getApiContext();
    const unauthorized = requireWorkerAdminOrCustomer(ctx);
    if (unauthorized) return unauthorized;

    console.log('[Monitoring GET] Fetching monitoring reports', {
      workerId: ctx.worker?.id,
      isAdmin: ctx.isAdmin,
      customerId: ctx.customer?.id,
    });

    const { data, error } = await ctx.supabase
      .from('monitoring_area_report')
      .select(
        `*,
        area_report:report_areas(*),
        sub_area:sub_areas(*),
        finding:findings(*),
        treatments:monitoring_treatments(
          *,
          material:materials(*),
          unit_type:unit_types(*),
          action_type:action_types(*)
        )`
      )
      .order('created_at', { ascending: false });

    if (error) throw error;

    console.log('[Monitoring GET] Fetched monitoring reports:', data?.length ?? 0);

    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getApiContext();
    const unauthorized = requireWorkerAdminOrCustomer(ctx);
    if (unauthorized) return unauthorized;

    const body: RequestBody = await request.json();

    if (isBatchRequest(body)) {
      const { area_id, worker_id, inspector_id, entries } = body;
      const effectiveWorkerId = worker_id || inspector_id;

      console.log('[Monitoring POST] Batch request', {
        area_id,
        workerId: effectiveWorkerId,
        entriesCount: entries.length,
      });

      if (!area_id) {
        return NextResponse.json({ error: 'area_id is required' }, { status: 400 });
      }

      if (entries.length === 0) {
        return NextResponse.json({ error: 'At least one entry is required' }, { status: 400 });
      }

      const reportAreaId = await findOrCreateReportArea(
        ctx.supabase,
        ctx.adminClient,
        area_id,
        AreaTypeId.MONITORING,
        { workerId: effectiveWorkerId }
      );

      const expandedEntries = expandEntries(entries);

      console.log('[Monitoring POST] Expanded entries:', {
        original: entries.length,
        expanded: expandedEntries.length,
      });

      const results = [];
      for (const entry of expandedEntries) {
        const monitoringReport = await createMonitoringReport(ctx.adminClient, reportAreaId, entry);
        await createTreatmentsFromEntry(ctx.adminClient, monitoringReport.id, entry);
        results.push(monitoringReport);
      }

      console.log('[Monitoring POST] Created monitoring reports:', results.length);

      return NextResponse.json(results, { status: 201 });
    }

    // Handle single entry request
    const {
      area_id,
      area_report_id: providedAreaReportId,
      worker_id,
      ...entryData
    } = body as SingleRequestBody;

    console.log('[Monitoring POST] Single entry request', {
      area_id,
      area_report_id: providedAreaReportId,
      worker_id,
      sub_area_id: entryData.sub_area_id,
      finding_id: entryData.finding_id,
    });

    let finalAreaReportId = providedAreaReportId;

    if (!finalAreaReportId && area_id) {
      finalAreaReportId = await findOrCreateReportArea(
        ctx.supabase,
        ctx.adminClient,
        area_id,
        AreaTypeId.MONITORING,
        { workerId: worker_id }
      );
    }

    if (!finalAreaReportId) {
      return NextResponse.json({ error: 'area_id or area_report_id is required' }, { status: 400 });
    }

    const monitoringReport = await createMonitoringReport(
      ctx.adminClient,
      finalAreaReportId,
      entryData
    );
    await createTreatmentsFromEntry(ctx.adminClient, monitoringReport.id, entryData);

    console.log('[Monitoring POST] Created monitoring report:', monitoringReport.id);

    return NextResponse.json(monitoringReport, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
