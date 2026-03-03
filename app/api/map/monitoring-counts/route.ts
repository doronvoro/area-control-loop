import { createClientFromRequest } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getCurrentCustomer, getCurrentWorker, requireAuth } from '@/lib/auth';

/**
 * GET /api/map/monitoring-counts
 * Returns pending monitoring report counts keyed by area/sub-area ID.
 * Covers ALL area types (indoor + outdoor).
 * Response: { counts: Record<string, number> }
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
      return NextResponse.json({ counts: {} });
    }

    // Get report_areas for our areas (small set — one per area visit)
    const { data: reportAreas, error: reportAreasError } = await supabase
      .from('report_areas')
      .select('id, area_id')
      .in('area_id', areaIds);

    if (reportAreasError) throw reportAreasError;

    const reportAreaIds = (reportAreas || []).map((ra: any) => ra.id);
    if (reportAreaIds.length === 0) {
      return NextResponse.json({ counts: {} });
    }

    // Build report_area_id → area_id mapping
    const reportAreaToArea: Record<string, string> = {};
    for (const ra of (reportAreas || []) as any[]) {
      reportAreaToArea[ra.id] = ra.area_id;
    }

    // Get ALL monitoring reports for these report_areas (filters through area, not sub-area)
    // Batch reportAreaIds if needed (unlikely to be large, but safe)
    const BATCH_SIZE = 100;
    const allReports: any[] = [];

    for (let i = 0; i < reportAreaIds.length; i += BATCH_SIZE) {
      const batch = reportAreaIds.slice(i, i + BATCH_SIZE);
      const { data: reports, error: reportsError } = await (
        supabase.from('monitoring_area_report') as any
      )
        .select('id, sub_area_id, area_report_id, status')
        .in('area_report_id', batch);

      if (reportsError) throw reportsError;
      if (reports) allReports.push(...reports);
    }

    const counts: Record<string, number> = {};

    // Get sub-areas to build sub_area → area mapping
    const { data: subAreas, error: subAreasError } = await supabase
      .from('sub_areas')
      .select('id, area_id')
      .in('area_id', areaIds);

    if (subAreasError) throw subAreasError;

    const subAreaToArea: Record<string, string> = {};
    for (const sa of (subAreas || []) as any[]) {
      subAreaToArea[sa.id] = sa.area_id;
    }

    // Count non-completed reports
    for (const report of allReports) {
      if (report.status === 'completed') continue;

      if (report.sub_area_id) {
        // Sub-area report
        counts[report.sub_area_id] =
          (counts[report.sub_area_id] || 0) + 1;
      } else {
        // Entire-area report: count under the area ID
        const areaId = reportAreaToArea[report.area_report_id];
        if (areaId) {
          counts[areaId] = (counts[areaId] || 0) + 1;
        }
      }
    }

    // Aggregate sub-area counts up to area level
    for (const sa of (subAreas || []) as any[]) {
      if (counts[sa.id]) {
        counts[sa.area_id] = (counts[sa.area_id] || 0) + counts[sa.id];
      }
    }

    return NextResponse.json({ counts });
  } catch (error: any) {
    // Re-throw Next.js internal errors (redirect, notFound)
    if (error?.digest?.startsWith('NEXT_')) {
      throw error;
    }
    console.error('monitoring-counts error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
