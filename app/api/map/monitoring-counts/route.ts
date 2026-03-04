import { createClientFromRequest } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getCurrentCustomer, getCurrentWorker, requireAuth } from '@/lib/auth';

/**
 * GET /api/map/monitoring-counts
 * Returns pending monitoring report counts and full report details keyed by area/sub-area ID.
 * Covers ALL area types (indoor + outdoor).
 * Response: { counts: Record<string, number>, reports: Record<string, MonitoringReportForMap[]> }
 */
export async function GET() {
  try {
    await requireAuth();

    const supabase = await createClientFromRequest();
    const customer = await getCurrentCustomer();
    const worker = await getCurrentWorker();

    const targetCustomerId =
      (customer as any)?.id || (worker as any)?.customer_id;

    if (!targetCustomerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get ALL areas for customer (no area_type filter)
    const { data: customerAreas, error: areasError } = await supabase
      .from('customer_areas')
      .select('area_id')
      .eq('customer_id', targetCustomerId);

    if (areasError) throw areasError;

    const areaIds = (customerAreas || []).map((item: any) => item.area_id);
    if (areaIds.length === 0) {
      return NextResponse.json({ counts: {}, reports: {} });
    }

    // Get report_areas for our areas (small set — one per area visit)
    const { data: reportAreas, error: reportAreasError } = await supabase
      .from('report_areas')
      .select('id, area_id')
      .in('area_id', areaIds);

    if (reportAreasError) throw reportAreasError;

    const reportAreaIds = (reportAreas || []).map((ra: any) => ra.id);
    if (reportAreaIds.length === 0) {
      return NextResponse.json({ counts: {}, reports: {} });
    }

    // Build report_area_id → area_id mapping
    const reportAreaToArea: Record<string, string> = {};
    for (const ra of (reportAreas || []) as any[]) {
      reportAreaToArea[ra.id] = ra.area_id;
    }

    // Get ALL monitoring reports with full details for these report_areas
    const BATCH_SIZE = 100;
    const allReports: any[] = [];

    for (let i = 0; i < reportAreaIds.length; i += BATCH_SIZE) {
      const batch = reportAreaIds.slice(i, i + BATCH_SIZE);
      const { data: reports, error: reportsError } = await (
        supabase.from('monitoring_area_report') as any
      )
        .select(
          `id, sub_area_id, area_report_id, status, severity, created_at,
          finding:findings(id, name),
          treatments:monitoring_treatments(
            id, dosage, status, notes,
            material:materials(name),
            action_type:action_types(name, description),
            unit_type:unit_types(name)
          )`
        )
        .in('area_report_id', batch);

      if (reportsError) throw reportsError;
      if (reports) allReports.push(...reports);
    }

    const counts: Record<string, number> = {};
    const reportsMap: Record<string, any[]> = {};

    // Get sub-areas to build sub_area → area mapping
    const { data: subAreas, error: subAreasError } = await supabase
      .from('sub_areas')
      .select('id, area_id')
      .in('area_id', areaIds);

    if (subAreasError) throw subAreasError;

    // Process reports: build counts and formatted reports
    for (const report of allReports) {
      if (report.status === 'completed') continue;

      const formatted = {
        id: report.id,
        finding_name: report.finding?.name || 'לא ידוע',
        severity: report.severity,
        status: report.status,
        created_at: report.created_at,
        treatments: (report.treatments || []).map((t: any) => ({
          id: t.id,
          action_type_name:
            t.action_type?.description || t.action_type?.name || null,
          material_name: t.material?.name || null,
          dosage: t.dosage,
          unit_type_name: t.unit_type?.name || null,
          status: t.status,
          notes: t.notes,
        })),
      };

      if (report.sub_area_id) {
        counts[report.sub_area_id] =
          (counts[report.sub_area_id] || 0) + 1;
        if (!reportsMap[report.sub_area_id]) reportsMap[report.sub_area_id] = [];
        reportsMap[report.sub_area_id].push(formatted);
      } else {
        const areaId = reportAreaToArea[report.area_report_id];
        if (areaId) {
          counts[areaId] = (counts[areaId] || 0) + 1;
          if (!reportsMap[areaId]) reportsMap[areaId] = [];
          reportsMap[areaId].push(formatted);
        }
      }
    }

    // Aggregate sub-area counts up to area level
    for (const sa of (subAreas || []) as any[]) {
      if (counts[sa.id]) {
        counts[sa.area_id] = (counts[sa.area_id] || 0) + counts[sa.id];
      }
    }

    return NextResponse.json({ counts, reports: reportsMap });
  } catch (error: any) {
    // Re-throw Next.js internal errors (redirect, notFound)
    if (error?.digest?.startsWith('NEXT_')) {
      throw error;
    }
    console.error('monitoring-counts error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
