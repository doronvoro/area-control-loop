import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getCurrentWorker, getCurrentCustomer, requireAuth } from '@/lib/auth';
import { hasRole } from '@/lib/permissions';
import { AreaTypeId } from '@/types/database';

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
    const customerId = searchParams.get('customerId') || (worker as any)?.customer_id || (customer as any)?.id || null;

    // Get areas accessible to this user
    let areaIds: string[] = [];

    if (isAdmin && !customerId) {
      // Admin without filter: get all areas that have reports
      const { data: allReportAreas } = await supabase
        .from('report_areas')
        .select('area_id')
        .eq('area_type_id', AreaTypeId.MONITORING);
      areaIds = [...new Set((allReportAreas || []).map((ra: any) => ra.area_id))];
    } else if (customerId) {
      const { data: customerAreas } = await supabase
        .from('customer_areas')
        .select('area_id')
        .eq('customer_id', customerId);
      areaIds = (customerAreas || []).map((ca: any) => ca.area_id);
    }

    if (areaIds.length === 0) {
      return NextResponse.json({ areas: [] });
    }

    // Get area details
    const { data: areas } = await supabase
      .from('areas')
      .select('id, name, description')
      .in('id', areaIds);

    // Get monitoring report areas
    const { data: monReportAreas } = await supabase
      .from('report_areas')
      .select('id, area_id')
      .eq('area_type_id', AreaTypeId.MONITORING)
      .in('area_id', areaIds);

    if (!monReportAreas || monReportAreas.length === 0) {
      // No monitoring data — all areas are "not inspected"
      const areasStatus = (areas || []).map((a: any) => ({
        id: a.id,
        name: a.name,
        status: 'no_monitoring',
        total_findings: 0,
        total_treatments: 0,
        completed_treatments: 0,
        pending_treatments: 0,
        last_monitoring: null,
        last_action: null,
      }));
      return NextResponse.json({ areas: areasStatus });
    }

    const reportAreaIds = monReportAreas.map((ra: any) => ra.id);
    const reportAreaToArea = Object.fromEntries(
      monReportAreas.map((ra: any) => [ra.id, ra.area_id])
    );

    // Get all monitoring reports with treatments
    const { data: monitoringReports } = await (supabase
      .from('monitoring_area_report') as any)
      .select(`
        id,
        area_report_id,
        created_at,
        treatments:monitoring_treatments (
          id,
          action_treatment_id
        )
      `)
      .in('area_report_id', reportAreaIds) as { data: any[] | null };

    // Get latest action dates per area
    const { data: actionReportAreas } = await supabase
      .from('report_areas')
      .select('id, area_id')
      .eq('area_type_id', AreaTypeId.ACTION)
      .in('area_id', areaIds);

    let latestActionByArea: Record<string, string> = {};
    if (actionReportAreas && actionReportAreas.length > 0) {
      const actionRAIds = actionReportAreas.map((ra: any) => ra.id);
      const actionRAToArea = Object.fromEntries(
        actionReportAreas.map((ra: any) => [ra.id, ra.area_id])
      );

      const { data: actionReports } = await (supabase
        .from('actions_area_report') as any)
        .select('id, area_report_id, created_at')
        .in('area_report_id', actionRAIds)
        .order('created_at', { ascending: false }) as { data: any[] | null };

      for (const ar of (actionReports || [])) {
        const aId = actionRAToArea[ar.area_report_id];
        if (aId && !latestActionByArea[aId]) {
          latestActionByArea[aId] = ar.created_at;
        }
      }
    }

    // Aggregate per area
    const areaStats: Record<string, {
      total_findings: number;
      total_treatments: number;
      completed_treatments: number;
      last_monitoring: string | null;
    }> = {};

    for (const report of (monitoringReports || [])) {
      const aId = reportAreaToArea[report.area_report_id];
      if (!aId) continue;

      if (!areaStats[aId]) {
        areaStats[aId] = {
          total_findings: 0,
          total_treatments: 0,
          completed_treatments: 0,
          last_monitoring: null,
        };
      }

      areaStats[aId].total_findings++;

      for (const t of (report.treatments || [])) {
        areaStats[aId].total_treatments++;
        if (t.action_treatment_id) {
          areaStats[aId].completed_treatments++;
        }
      }

      if (!areaStats[aId].last_monitoring || report.created_at > areaStats[aId].last_monitoring!) {
        areaStats[aId].last_monitoring = report.created_at;
      }
    }

    // Build response
    const areasStatus = (areas || []).map((a: any) => {
      const stats = areaStats[a.id];
      if (!stats) {
        return {
          id: a.id,
          name: a.name,
          status: 'no_monitoring',
          total_findings: 0,
          total_treatments: 0,
          completed_treatments: 0,
          pending_treatments: 0,
          last_monitoring: null,
          last_action: null,
        };
      }

      const pending = stats.total_treatments - stats.completed_treatments;
      let status: string;
      if (stats.total_treatments === 0) {
        status = 'no_monitoring';
      } else if (stats.completed_treatments === stats.total_treatments) {
        status = 'all_done';
      } else if (stats.completed_treatments > 0) {
        status = 'partial';
      } else {
        status = 'needs_action';
      }

      return {
        id: a.id,
        name: a.name,
        status,
        total_findings: stats.total_findings,
        total_treatments: stats.total_treatments,
        completed_treatments: stats.completed_treatments,
        pending_treatments: pending,
        last_monitoring: stats.last_monitoring,
        last_action: latestActionByArea[a.id] || null,
      };
    });

    return NextResponse.json({ areas: areasStatus });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
