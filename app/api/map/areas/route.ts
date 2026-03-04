import { createClientFromRequest } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getCurrentCustomer, getCurrentWorker, requireAuth } from '@/lib/auth';

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

    // Get areas for customer with geometry (exclude indoor areas)
    const { data: customerAreas, error: areasError } = await supabase
      .from('customer_areas')
      .select(
        'area_id, areas(id, name, description, geometry, area_type)'
      )
      .eq('customer_id', targetCustomerId);

    if (areasError) throw areasError;

    const areas = (customerAreas || [])
      .map((item: any) => item.areas)
      .filter(Boolean)
      .filter((area: any) => area.area_type !== 'indoor');

    // Get sub-areas for all these areas
    const areaIds = areas.map((a: any) => a.id);

    if (areaIds.length === 0) {
      return NextResponse.json({ areas: [] });
    }

    const { data: subAreas, error: subAreasError } = await supabase
      .from('sub_areas')
      .select('id, area_id, name, display, variety, level, geometry')
      .in('area_id', areaIds)
      .order('level', { ascending: true })
      .order('name', { ascending: true });

    if (subAreasError) throw subAreasError;

    // Get monitoring reports via report_areas (avoids PostgREST URL length limit)
    const monitoringBySubArea: Record<string, any[]> = {};

    if (areaIds.length > 0) {
      // Get report_areas for our areas
      const { data: reportAreas, error: reportAreasError } = await supabase
        .from('report_areas')
        .select('id, area_id')
        .in('area_id', areaIds);

      if (!reportAreasError && reportAreas && reportAreas.length > 0) {
        const reportAreaIds = reportAreas.map((ra: any) => ra.id);
        const reportAreaToArea: Record<string, string> = {};
        for (const ra of reportAreas as any[]) {
          reportAreaToArea[ra.id] = ra.area_id;
        }

        // Batch fetch monitoring reports
        const BATCH_SIZE = 100;
        const allReports: any[] = [];
        for (let i = 0; i < reportAreaIds.length; i += BATCH_SIZE) {
          const batch = reportAreaIds.slice(i, i + BATCH_SIZE);
          const { data: reports, error: reportsError } = await (
            supabase.from('monitoring_area_report') as any
          )
            .select(
              `id, sub_area_id, area_report_id, severity, status, created_at,
              finding:findings(id, name),
              treatments:monitoring_treatments(
                id, dosage, status, notes,
                material:materials(name),
                action_type:action_types(name, description),
                unit_type:unit_types(name)
              )`
            )
            .in('area_report_id', batch);
          if (!reportsError && reports) allReports.push(...reports);
        }

        for (const report of allReports) {
          const reportFormatted = {
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
            if (!monitoringBySubArea[report.sub_area_id]) {
              monitoringBySubArea[report.sub_area_id] = [];
            }
            monitoringBySubArea[report.sub_area_id].push(reportFormatted);
          } else {
            // Entire-area report: associate with all sub-areas of that area
            const areaId = reportAreaToArea[report.area_report_id];
            if (areaId) {
              const relevantSubAreas = ((subAreas || []) as any[]).filter(
                (sa: any) => sa.area_id === areaId
              );
              for (const sa of relevantSubAreas) {
                if (!monitoringBySubArea[sa.id]) {
                  monitoringBySubArea[sa.id] = [];
                }
                monitoringBySubArea[sa.id].push({ ...reportFormatted, is_entire_area: true });
              }
            }
          }
        }
      }
    }

    // Nest sub-areas under their areas with monitoring data
    const areasWithSubAreas = areas.map((area: any) => {
      const areaSubAreas = (subAreas || [])
        .filter((sa: any) => sa.area_id === area.id)
        .map((sa: any) => {
          const reports = monitoringBySubArea[sa.id] || [];
          const pendingCount = reports.filter(
            (r: any) => r.status !== 'completed'
          ).length;
          return {
            ...sa,
            pending_monitoring: pendingCount,
            monitoring_reports: reports,
          };
        });

      const areaPending = areaSubAreas.reduce(
        (sum: number, sa: any) => sum + sa.pending_monitoring,
        0
      );

      return {
        ...area,
        pending_monitoring: areaPending,
        sub_areas: areaSubAreas,
      };
    });

    return NextResponse.json({ areas: areasWithSubAreas });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
