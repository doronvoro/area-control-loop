import { NextResponse } from 'next/server';
import { getApiContext, requireWorkerAdminOrCustomer } from '@/lib/api/auth-context';
import { handleApiError } from '@/lib/api-utils';
import { AreaTypeId } from '@/types/database';
import { updateReportStatuses } from '@/lib/report-status';

interface CompletedTask {
  monitoring_treatment_id: string;
  monitoring_report_id: string;
  as_recommended: boolean;
  material_id?: string;
  dosage?: number | string;
  unit_type_id?: string;
  action_type_id?: string;
  notes?: string;
}

interface StandaloneAction {
  sub_area_id: string | null;
  finding_id: string;
  severity?: string;
  action_type_id?: string;
  material_id?: string;
  dosage?: number | string;
  unit_type_id?: string;
  notes?: string;
}

interface RequestBody {
  area_id: string;
  worker_id?: string;
  completed_tasks?: CompletedTask[];
  standalone_actions?: StandaloneAction[];
}

function parseDosage(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  return typeof value === 'string' ? parseFloat(value) : value;
}

export async function POST(request: Request) {
  try {
    const ctx = await getApiContext();

    const authError = requireWorkerAdminOrCustomer(ctx);
    if (authError) return authError;

    const body: RequestBody = await request.json();
    const { area_id, worker_id, completed_tasks = [], standalone_actions = [] } = body;

    if (!area_id) {
      return NextResponse.json({ error: 'area_id is required' }, { status: 400 });
    }

    if (completed_tasks.length === 0 && standalone_actions.length === 0) {
      return NextResponse.json({ error: 'No tasks or actions provided' }, { status: 400 });
    }

    const effectiveWorkerId = worker_id || ctx.worker?.id || null;

    // Step 1: Get or create report_areas for actions
    const { data: existingReportAreas } = await (ctx.supabase
      .from('report_areas') as any)
      .select('id')
      .eq('area_id', area_id)
      .eq('area_type_id', AreaTypeId.ACTION) as { data: { id: string }[] | null };

    let reportAreaId: string;

    if (existingReportAreas && existingReportAreas.length > 0) {
      reportAreaId = existingReportAreas[0].id;
      // Update worker_id on existing report_areas if provided
      if (effectiveWorkerId) {
        await (ctx.adminClient
          .from('report_areas') as any)
          .update({ worker_id: effectiveWorkerId })
          .eq('id', reportAreaId);
      }
    } else {
      const { data: areaData } = await ctx.supabase
        .from('areas')
        .select('name')
        .eq('id', area_id)
        .single() as { data: { name: string } | null };

      const { data: newReportArea, error: createError } = await (ctx.adminClient
        .from('report_areas') as any)
        .insert({
          area_id,
          area_type_id: AreaTypeId.ACTION,
          name: `דוח פעולה - ${areaData?.name || 'שטח'}`,
          description: 'דוח פעולה',
          worker_id: effectiveWorkerId,
        })
        .select('id')
        .single();

      if (createError) throw createError;
      reportAreaId = newReportArea.id;
    }

    const results: any[] = [];
    const errors: string[] = [];

    // Step 2: Process completed tasks (from monitoring)
    for (const task of completed_tasks) {
      try {
        // Fetch the monitoring treatment to get recommendation data
        const { data: monitoringTreatment, error: mtError } = await (ctx.supabase
          .from('monitoring_treatments') as any)
          .select(`
            *,
            monitoring_report:monitoring_area_report (
              id,
              sub_area_id,
              finding_id,
              severity
            )
          `)
          .eq('id', task.monitoring_treatment_id)
          .single() as { data: any; error: any };

        if (mtError) throw mtError;
        if (!monitoringTreatment) {
          errors.push(`Monitoring treatment ${task.monitoring_treatment_id} not found`);
          continue;
        }

        // Check if already processed
        if (monitoringTreatment.action_treatment_id) {
          errors.push(`Monitoring treatment ${task.monitoring_treatment_id} already has an action`);
          continue;
        }

        const monReport = monitoringTreatment.monitoring_report as any;
        const subAreaId = monReport.sub_area_id ?? null;
        const findingId = monReport.finding_id;
        const severity = monReport.severity;

        // Get or create actions_area_report for this sub_area + finding
        let existingActionQuery = (ctx.supabase
          .from('actions_area_report') as any)
          .select('id')
          .eq('area_report_id', reportAreaId)
          .eq('finding_id', findingId);

        if (subAreaId === null) {
          existingActionQuery = existingActionQuery.is('sub_area_id', null);
        } else {
          existingActionQuery = existingActionQuery.eq('sub_area_id', subAreaId);
        }

        const { data: existingAction } = await existingActionQuery.maybeSingle() as { data: { id: string } | null };

        let actionReportId: string;

        if (existingAction) {
          actionReportId = existingAction.id;
        } else {
          const { data: newAction, error: actionError } = await (ctx.adminClient
            .from('actions_area_report') as any)
            .insert({
              area_report_id: reportAreaId,
              sub_area_id: subAreaId,
              finding_id: findingId,
              severity: severity || null,
            })
            .select('id')
            .single();

          if (actionError) throw actionError;
          actionReportId = newAction.id;
        }

        // Determine treatment values (use recommendation or overrides)
        const materialId = task.as_recommended
          ? monitoringTreatment.material_id
          : (task.material_id || monitoringTreatment.material_id);
        const dosage = task.as_recommended
          ? monitoringTreatment.dosage
          : parseDosage(task.dosage) ?? monitoringTreatment.dosage;
        const unitTypeId = task.as_recommended
          ? monitoringTreatment.unit_type_id
          : (task.unit_type_id || monitoringTreatment.unit_type_id);
        const actionTypeId = task.as_recommended
          ? monitoringTreatment.action_type_id
          : (task.action_type_id || monitoringTreatment.action_type_id);

        // Create action treatment
        const { data: actionTreatment, error: atError } = await (ctx.adminClient
          .from('action_treatments') as any)
          .insert({
            action_report_id: actionReportId,
            material_id: materialId || null,
            dosage: dosage || null,
            unit_type_id: unitTypeId || null,
            action_type_id: actionTypeId || null,
            notes: task.notes || null,
            action_time: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (atError) throw atError;

        // Link monitoring treatment to action treatment
        const { error: linkError } = await (ctx.adminClient
          .from('monitoring_treatments') as any)
          .update({
            action_treatment_id: actionTreatment.id,
          })
          .eq('id', task.monitoring_treatment_id);

        if (linkError) throw linkError;

        // Link monitoring report to action report (if not already linked)
        if (task.monitoring_report_id) {
          const { error: reportLinkError } = await (ctx.adminClient
            .from('monitoring_area_report') as any)
            .update({
              actions_area_report_id: actionReportId,
            })
            .eq('id', task.monitoring_report_id)
            .is('actions_area_report_id', null);

          if (reportLinkError) throw reportLinkError;
        }

        results.push({
          type: 'completed_task',
          monitoring_treatment_id: task.monitoring_treatment_id,
          action_treatment_id: actionTreatment.id,
          action_report_id: actionReportId,
        });
      } catch (taskError: unknown) {
        const msg = taskError instanceof Error ? taskError.message : 'Unknown error';
        errors.push(`Failed to process task ${task.monitoring_treatment_id}: ${msg}`);
      }
    }

    // Step 3: Process standalone actions
    for (const action of standalone_actions) {
      try {
        if (!action.finding_id) {
          errors.push('Standalone action missing finding_id');
          continue;
        }

        // Get or create actions_area_report
        let existingStandaloneQuery = (ctx.supabase
          .from('actions_area_report') as any)
          .select('id')
          .eq('area_report_id', reportAreaId)
          .eq('finding_id', action.finding_id);

        if (action.sub_area_id === null || action.sub_area_id === undefined) {
          existingStandaloneQuery = existingStandaloneQuery.is('sub_area_id', null);
        } else {
          existingStandaloneQuery = existingStandaloneQuery.eq('sub_area_id', action.sub_area_id);
        }

        const { data: existingAction } = await existingStandaloneQuery.maybeSingle() as { data: { id: string } | null };

        let actionReportId: string;

        if (existingAction) {
          actionReportId = existingAction.id;
        } else {
          const { data: newAction, error: actionError } = await (ctx.adminClient
            .from('actions_area_report') as any)
            .insert({
              area_report_id: reportAreaId,
              sub_area_id: action.sub_area_id ?? null,
              finding_id: action.finding_id,
              severity: action.severity || null,
            })
            .select('id')
            .single();

          if (actionError) throw actionError;
          actionReportId = newAction.id;
        }

        // Create action treatment
        const { data: actionTreatment, error: atError } = await (ctx.adminClient
          .from('action_treatments') as any)
          .insert({
            action_report_id: actionReportId,
            material_id: action.material_id || null,
            dosage: parseDosage(action.dosage),
            unit_type_id: action.unit_type_id || null,
            action_type_id: action.action_type_id || null,
            notes: action.notes || null,
            action_time: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (atError) throw atError;

        results.push({
          type: 'standalone_action',
          action_treatment_id: actionTreatment.id,
          action_report_id: actionReportId,
        });
      } catch (actionError: unknown) {
        const msg = actionError instanceof Error ? actionError.message : 'Unknown error';
        errors.push(`Failed to create standalone action: ${msg}`);
      }
    }

    // Step 4: Update statuses across all affected tables
    const monitoringReportIds = [...new Set(
      results
        .filter((r: any) => r.type === 'completed_task' && r.monitoring_treatment_id)
        .map((r: any) => {
          const task = completed_tasks.find(t => t.monitoring_treatment_id === r.monitoring_treatment_id);
          return task?.monitoring_report_id;
        })
        .filter(Boolean)
    )] as string[];

    const actionReportIds = [...new Set(
      results.map((r: any) => r.action_report_id).filter(Boolean)
    )] as string[];

    // Look up the monitoring report_areas ID for the same area
    let monitoringReportAreaId: string | undefined;
    if (monitoringReportIds.length > 0) {
      const { data: monReportArea } = await (ctx.supabase
        .from('report_areas') as any)
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

    return NextResponse.json({
      success: true,
      results,
      errors: errors.length > 0 ? errors : undefined,
    }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
