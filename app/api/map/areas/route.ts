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

    // Nest sub-areas under their areas
    const areasWithSubAreas = areas.map((area: any) => ({
      ...area,
      sub_areas: (subAreas || []).filter((sa: any) => sa.area_id === area.id),
    }));

    return NextResponse.json({ areas: areasWithSubAreas });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
