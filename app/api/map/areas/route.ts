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

    // Get pending monitoring counts per sub-area
    const subAreaIds = (subAreas || []).map((sa: any) => sa.id);
    let pendingCounts: Record<string, number> = {};

    if (subAreaIds.length > 0) {
      const { data: pendingData, error: pendingError } = await (supabase
        .from('monitoring_area_report') as any)
        .select('sub_area_id')
        .in('sub_area_id', subAreaIds)
        .neq('status', 'completed');

      if (!pendingError && pendingData) {
        for (const row of pendingData as any[]) {
          pendingCounts[row.sub_area_id] =
            (pendingCounts[row.sub_area_id] || 0) + 1;
        }
      }
    }

    // Nest sub-areas under their areas with pending counts
    const areasWithSubAreas = areas.map((area: any) => {
      const areaSubAreas = (subAreas || [])
        .filter((sa: any) => sa.area_id === area.id)
        .map((sa: any) => ({
          ...sa,
          pending_monitoring: pendingCounts[sa.id] || 0,
        }));

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
