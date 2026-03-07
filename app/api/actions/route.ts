import { NextResponse } from 'next/server';
import { getApiContext, requireWorkerOrAdmin } from '@/lib/api/auth-context';
import { handleApiError } from '@/lib/api-utils';
import { findOrCreateReportArea, parseDosage } from '@/lib/api/utils';
import { AreaTypeId } from '@/types/database';
import { updateReportStatuses } from '@/lib/report-status';
import type { SupabaseClient } from '@supabase/supabase-js';

// --- Treatment helpers ---

interface ActionTreatmentInput {
  material_id?: string | null;
  dosage?: string | number | null;
  unit_type_id?: string | null;
  action_type_id?: string | null;
  status?: string;
  notes?: string | null;
  action_time?: string | null;
  monitoring_treatment_id?: string | null;
}

async function createActionTreatment(
  supabase: SupabaseClient,
  actionReportId: string,
  treatment: ActionTreatmentInput
): Promise<any> {
  const { data, error } = await (supabase.from('action_treatments') as any)
    .insert({
      action_report_id: actionReportId,
      material_id: treatment.material_id || null,
      dosage: parseDosage(treatment.dosage),
      unit_type_id: treatment.unit_type_id || null,
      action_type_id: treatment.action_type_id || null,
      status: treatment.status || 'pending',
      notes: treatment.notes || null,
      action_time: treatment.action_time || null,
    })
    .select()
    .single();

  if (error) throw error;

  // Link monitoring treatment to action treatment if provided
  if (treatment.monitoring_treatment_id && data) {
    const { error: linkError } = await (supabase.from('monitoring_treatments') as any)
      .update({ action_treatment_id: data.id })
      .eq('id', treatment.monitoring_treatment_id);
    if (linkError) throw linkError;
  }

  return data;
}

async function createActionTreatmentsFromEntry(
  supabase: SupabaseClient,
  actionReportId: string,
  entry: any
): Promise<void> {
  if (entry.treatments && Array.isArray(entry.treatments)) {
    for (const treatment of entry.treatments) {
      await createActionTreatment(supabase, actionReportId, treatment);
    }
    return;
  }

  // Legacy format - create single treatment from entry fields
  const materialId = entry.material_id || entry.material;
  const actionTypeId = entry.action_type_id;

  if (actionTypeId || materialId) {
    await createActionTreatment(supabase, actionReportId, {
      material_id: entry.material_id || null,
      dosage: entry.dosage,
      unit_type_id: entry.unit_type_id || null,
      action_type_id: actionTypeId || null,
      status: entry.status || 'pending',
      notes: entry.notes || null,
      action_time: entry.action_time || null,
    });
  }
}

// --- Route handlers ---

export async function GET() {
  try {
    const ctx = await getApiContext();
    const unauthorized = requireWorkerOrAdmin(ctx);
    if (unauthorized) return unauthorized;

    console.log('[Actions GET] Fetching action reports', {
      workerId: ctx.worker?.id,
      isAdmin: ctx.isAdmin,
    });

    const { data, error } = await ctx.supabase
      .from('actions_area_report')
      .select(
        `*,
        area_report:report_areas(*),
        sub_area:sub_areas(*),
        finding:findings(*),
        treatments:action_treatments(
          *,
          material:materials(*),
          unit_type:unit_types(*),
          action_type:action_types(*)
        )`
      )
      .order('created_at', { ascending: false });

    if (error) throw error;

    console.log('[Actions GET] Fetched action reports:', data?.length ?? 0);

    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getApiContext();
    const unauthorized = requireWorkerOrAdmin(ctx);
    if (unauthorized) return unauthorized;

    const body = await request.json();

    // Handle batch creation (admin form with entries array)
    if (body.entries && Array.isArray(body.entries)) {
      const { area_id, worker_id, entries } = body;

      console.log('[Actions POST] Batch request', {
        area_id,
        worker_id,
        entriesCount: entries.length,
      });

      if (!area_id) {
        return NextResponse.json({ error: 'area_id is required' }, { status: 400 });
      }

      const reportAreaId = await findOrCreateReportArea(
        ctx.supabase,
        ctx.adminClient,
        area_id,
        AreaTypeId.ACTION,
        { reuseExisting: true, workerId: worker_id }
      );

      const results: any[] = [];

      for (const entry of entries) {
        const { data: actionData, error: actionError } = await ctx.supabase
          .from('actions_area_report')
          .insert({
            area_report_id: reportAreaId,
            sub_area_id: entry.sub_area_id,
            finding_id: entry.finding_id,
            severity: entry.severity || null,
          } as any)
          .select()
          .single();

        if (actionError) throw actionError;

        await createActionTreatmentsFromEntry(ctx.supabase, (actionData as any).id, entry);

        // Link to monitoring report if provided
        if (entry.monitoring_report_id && actionData) {
          const { error: monitoringError } = await (ctx.supabase.from('monitoring_area_report') as any)
            .update({ actions_area_report_id: (actionData as any).id })
            .eq('id', entry.monitoring_report_id);
          if (monitoringError) throw monitoringError;
        }

        results.push(actionData);
      }

      // Update statuses
      const monitoringReportIds = entries
        .map((e: any) => e.monitoring_report_id)
        .filter(Boolean) as string[];
      const actionReportIds = results
        .map((r: any) => r.id)
        .filter(Boolean) as string[];

      let monitoringReportAreaId: string | undefined;
      if (monitoringReportIds.length > 0) {
        const { data: monReportArea } = await (ctx.supabase.from('report_areas') as any)
          .select('id')
          .eq('area_id', area_id)
          .eq('area_type_id', AreaTypeId.MONITORING)
          .maybeSingle() as { data: { id: string } | null };
        monitoringReportAreaId = monReportArea?.id;
      }

      await updateReportStatuses(ctx.adminClient, {
        monitoringReportIds,
        actionReportIds,
        monitoringReportAreaId,
        actionReportAreaId: reportAreaId,
      });

      console.log('[Actions POST] Created action reports:', results.length);

      return NextResponse.json(results, { status: 201 });
    }

    // Handle single action creation (legacy format)
    console.log('[Actions POST] Single entry request', {
      area_report_id: body.area_report_id,
      sub_area_id: body.sub_area_id,
      finding_id: body.finding_id,
    });

    const {
      area_report_id,
      sub_area_id,
      finding_id,
      severity,
      monitoring_report_id,
    } = body;

    const { data: actionData, error: actionError } = await ctx.supabase
      .from('actions_area_report')
      .insert({
        area_report_id,
        sub_area_id,
        finding_id,
        severity: severity || null,
      } as any)
      .select()
      .single();

    if (actionError) throw actionError;

    await createActionTreatmentsFromEntry(ctx.supabase, (actionData as any).id, body);

    // Link to monitoring report if provided
    if (monitoring_report_id && actionData) {
      const { error: monitoringError } = await (ctx.supabase.from('monitoring_area_report') as any)
        .update({ actions_area_report_id: (actionData as any).id })
        .eq('id', monitoring_report_id);
      if (monitoringError) throw monitoringError;
    }

    // Update statuses
    const singleMonitoringReportIds = monitoring_report_id ? [monitoring_report_id] : [];
    const singleActionReportIds = actionData ? [(actionData as any).id] : [];

    let singleMonitoringReportAreaId: string | undefined;
    if (singleMonitoringReportIds.length > 0) {
      const { data: reportArea } = await (ctx.supabase.from('report_areas') as any)
        .select('id, area_id')
        .eq('id', area_report_id)
        .single() as { data: { id: string; area_id: string } | null };

      if (reportArea) {
        const { data: monReportArea } = await (ctx.supabase.from('report_areas') as any)
          .select('id')
          .eq('area_id', reportArea.area_id)
          .eq('area_type_id', AreaTypeId.MONITORING)
          .maybeSingle() as { data: { id: string } | null };
        singleMonitoringReportAreaId = monReportArea?.id;
      }
    }

    await updateReportStatuses(ctx.adminClient, {
      monitoringReportIds: singleMonitoringReportIds,
      actionReportIds: singleActionReportIds,
      monitoringReportAreaId: singleMonitoringReportAreaId,
      actionReportAreaId: area_report_id,
    });

    console.log('[Actions POST] Created action report:', (actionData as any)?.id);

    return NextResponse.json(actionData, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
