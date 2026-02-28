import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getCurrentWorker, getCurrentCustomer, requireAuth } from '@/lib/auth';
import { hasRole } from '@/lib/permissions';
import { AreaTypeId } from '@/types/database';
import { ENTIRE_AREA_DISPLAY } from '@/lib/constants';

export async function GET(request: Request) {
  try {
    await requireAuth();
    const supabase = await createClient();
    const worker = await getCurrentWorker();
    const isAdmin = await hasRole('admin');
    const customer = await getCurrentCustomer();

    if (!worker && !isAdmin && !customer) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const areaId = searchParams.get('areaId');

    // Determine which areas the user can access
    const customerId = (worker as any)?.customer_id || (customer as any)?.id || null;

    // Get ALL accessible area IDs (for the dropdown list)
    let allAccessibleAreaIds: string[] = [];

    if (isAdmin) {
      // Admin sees all areas
      const { data: allAreas } = await supabase
        .from('areas')
        .select('id');
      allAccessibleAreaIds = (allAreas || []).map((a: any) => a.id);
    } else if (customerId) {
      const { data: customerAreas } = await supabase
        .from('customer_areas')
        .select('area_id')
        .eq('customer_id', customerId);
      allAccessibleAreaIds = (customerAreas || []).map((ca: any) => ca.area_id);
    }

    // Determine which areas to fetch tasks for
    const taskAreaIds = areaId ? [areaId] : allAccessibleAreaIds;

    if (allAccessibleAreaIds.length === 0) {
      return NextResponse.json({ tasks: [], areas: [] });
    }

    // Get area details (all accessible areas for dropdown)
    const { data: areas } = await (supabase
      .from('areas') as any)
      .select('id, name, crop_id')
      .in('id', allAccessibleAreaIds) as { data: any[] | null };

    // Get report_areas for task areas (monitoring type only)
    const { data: reportAreas, error: raError } = await (supabase
      .from('report_areas') as any)
      .select('id, area_id, name, worker_id')
      .eq('area_type_id', AreaTypeId.MONITORING)
      .in('area_id', taskAreaIds) as { data: any[] | null; error: any };

    if (raError) throw raError;
    if (!reportAreas || reportAreas.length === 0) {
      return NextResponse.json({ tasks: [], areas: areas || [] });
    }

    const reportAreaIds = reportAreas.map((ra: any) => ra.id);

    // Get all monitoring reports with treatments
    const { data: monitoringReports, error: mrError } = await (supabase
      .from('monitoring_area_report') as any)
      .select(`
        id,
        area_report_id,
        sub_area_id,
        finding_id,
        severity,
        actions_area_report_id,
        created_at,
        report_area:report_areas!inner (
          id,
          area_id,
          name
        ),
        sub_area:sub_areas (
          id,
          name,
          display,
          crop_id,
          area_id
        ),
        finding:findings!inner (
          id,
          name,
          description
        ),
        treatments:monitoring_treatments (
          id,
          material_id,
          dosage,
          unit_type_id,
          action_type_id,
          notes,
          action_treatment_id,
          material:materials (
            id,
            name,
            description
          ),
          action_type:action_types (
            id,
            name,
            description
          ),
          unit_type:unit_types (
            id,
            name,
            description
          )
        )
      `)
      .in('area_report_id', reportAreaIds)
      .order('created_at', { ascending: false }) as { data: any[] | null; error: any };

    if (mrError) throw mrError;

    // Build task list: one task per unfulfilled monitoring treatment
    const tasks: any[] = [];

    for (const report of (monitoringReports || [])) {
      const reportArea = report.report_area as any;
      const subArea = report.sub_area as any;
      const finding = report.finding as any;
      const areaData = (areas || []).find((a: any) => a.id === reportArea?.area_id || a.id === subArea?.area_id);
      const effectiveCropId = subArea?.crop_id || areaData?.crop_id || null;

      for (const treatment of (report.treatments || [])) {
        // Skip treatments that already have a linked action treatment
        if (treatment.action_treatment_id) continue;

        tasks.push({
          monitoring_treatment_id: treatment.id,
          monitoring_report_id: report.id,
          area_id: reportArea?.area_id,
          area_name: areaData?.name || '',
          sub_area: subArea ? {
            id: subArea.id,
            name: subArea.name,
            display: subArea.display,
          } : {
            id: null,
            name: ENTIRE_AREA_DISPLAY,
            display: ENTIRE_AREA_DISPLAY,
          },
          finding: {
            id: finding?.id,
            name: finding?.name,
            description: finding?.description,
          },
          severity: report.severity,
          recommendation: {
            action_type: treatment.action_type || null,
            material: treatment.material || null,
            dosage: treatment.dosage,
            unit_type: treatment.unit_type || null,
          },
          notes: treatment.notes,
          monitoring_date: report.created_at,
          effective_crop_id: effectiveCropId,
        });
      }
    }

    return NextResponse.json({
      tasks,
      areas: areas || [],
    });
  } catch (error: unknown) {
    // Re-throw Next.js redirects (from requireAuth)
    if (error && typeof error === 'object' && 'digest' in error) {
      throw error;
    }
    console.error('GET /api/action-tasks error:', JSON.stringify(error, null, 2));
    const message = error instanceof Error
      ? error.message
      : (error && typeof error === 'object' && 'message' in error)
        ? (error as any).message
        : JSON.stringify(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
