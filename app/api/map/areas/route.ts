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

    // Get areas for customer with geometry
    const { data: customerAreas, error: areasError } = await supabase
      .from('customer_areas')
      .select(
        'area_id, areas(id, name, description, geometry)'
      )
      .eq('customer_id', targetCustomerId);

    if (areasError) throw areasError;

    const areas = (customerAreas || [])
      .map((item: any) => item.areas)
      .filter(Boolean);

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

    // Get monitoring reports with findings and treatments per sub-area
    const subAreaIds = (subAreas || []).map((sa: any) => sa.id);
    const monitoringBySubArea: Record<string, any[]> = {};

    if (subAreaIds.length > 0) {
      const { data: monitoringData, error: monitoringError } = await (
        supabase.from('monitoring_area_report') as any
      )
        .select(
          `id, sub_area_id, severity, status, created_at,
          finding:findings(id, name),
          treatments:monitoring_treatments(
            id, dosage, status, notes,
            material:materials(name),
            action_type:action_types(name, description),
            unit_type:unit_types(name)
          )`
        )
        .in('sub_area_id', subAreaIds)
        .order('created_at', { ascending: false });

      if (!monitoringError && monitoringData) {
        for (const report of monitoringData as any[]) {
          const subAreaId = report.sub_area_id;
          if (!monitoringBySubArea[subAreaId]) {
            monitoringBySubArea[subAreaId] = [];
          }
          monitoringBySubArea[subAreaId].push({
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
          });
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
