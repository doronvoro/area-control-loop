import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getCurrentWorker, getCurrentCustomer, requireAuth } from '@/lib/auth';
import { hasRole } from '@/lib/permissions';
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
  sub_area_id: string;
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

interface BatchRequestBody {
  area_id: string;
  worker_id?: string;
  inspector_id?: string; // Alias for worker_id from monitoring form
  entries: MonitoringEntryInput[];
}

interface SingleRequestBody extends MonitoringEntryInput {
  area_id?: string;
  area_report_id?: string;
  worker_id?: string;
}

type RequestBody = BatchRequestBody | SingleRequestBody;

// Helper functions
function parseDosage(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  return typeof value === 'string' ? parseFloat(value) : value;
}

async function getOrCreateReportArea(
  supabase: SupabaseClient,
  adminClient: SupabaseClient,
  areaId: string,
  workerId?: string
): Promise<string> {
  // Try to find an existing monitoring report_area for this area
  const { data: existingReportArea } = await supabase
    .from('report_areas')
    .select('id')
    .eq('area_id', areaId)
    .eq('area_type_id', AreaTypeId.MONITORING)
    .maybeSingle();

  if (existingReportArea) {
    return existingReportArea.id;
  }

  // Get area name for the new report_area
  const { data: areaData } = await supabase.from('areas').select('name').eq('id', areaId).single();

  const { data: newReportArea, error: createError } = await adminClient
    .from('report_areas')
    .insert({
      area_id: areaId,
      area_type_id: AreaTypeId.MONITORING,
      name: `דוח ניטור - ${areaData?.name || 'אזור'}`,
      description: 'דוח ניטור',
      worker_id: workerId || null,
    })
    .select('id')
    .single();

  if (createError) throw createError;
  return newReportArea.id;
}

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

  // Legacy format - create single treatment from entry fields
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
    await requireAuth();
    const supabase = await createClient();
    const worker = await getCurrentWorker();
    const isAdmin = await hasRole('admin');
    const customer = await getCurrentCustomer();

    if (!worker && !isAdmin && !customer) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
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

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAuth();
    const supabase = await createClient();
    const worker = await getCurrentWorker();
    const isAdmin = await hasRole('admin');
    const customer = await getCurrentCustomer();

    if (!worker && !isAdmin && !customer) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: RequestBody = await request.json();
    const adminClient = createAdminClient();

    // Handle batch request
    if (isBatchRequest(body)) {
      const { area_id, worker_id, inspector_id, entries } = body;
      // Use worker_id if provided, otherwise use inspector_id (from monitoring form)
      const effectiveWorkerId = worker_id || inspector_id;

      if (!area_id) {
        return NextResponse.json({ error: 'area_id is required' }, { status: 400 });
      }

      if (entries.length === 0) {
        return NextResponse.json({ error: 'At least one entry is required' }, { status: 400 });
      }

      const reportAreaId = await getOrCreateReportArea(supabase, adminClient, area_id, effectiveWorkerId);

      const results = [];
      for (const entry of entries) {
        const monitoringReport = await createMonitoringReport(adminClient, reportAreaId, entry);
        await createTreatmentsFromEntry(adminClient, monitoringReport.id, entry);
        results.push(monitoringReport);
      }

      return NextResponse.json(results, { status: 201 });
    }

    // Handle single entry request
    const {
      area_id,
      area_report_id: providedAreaReportId,
      worker_id,
      ...entryData
    } = body as SingleRequestBody;

    let finalAreaReportId = providedAreaReportId;

    if (!finalAreaReportId && area_id) {
      finalAreaReportId = await getOrCreateReportArea(supabase, adminClient, area_id, worker_id);
    }

    if (!finalAreaReportId) {
      return NextResponse.json({ error: 'area_id or area_report_id is required' }, { status: 400 });
    }

    const monitoringReport = await createMonitoringReport(
      adminClient,
      finalAreaReportId,
      entryData
    );
    await createTreatmentsFromEntry(adminClient, monitoringReport.id, entryData);

    return NextResponse.json(monitoringReport, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
