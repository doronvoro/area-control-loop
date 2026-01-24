import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export async function GET(request: Request) {
  try {
    await requireAuth();
    const { searchParams } = new URL(request.url);
    const areaId = searchParams.get('areaId');

    if (!areaId) {
      return NextResponse.json(
        { error: 'areaId is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Get all report areas for this area
    const { data: reportAreas, error: reportAreasError } = await supabase
      .from('report_areas')
      .select('id')
      .eq('area_id', areaId);

    if (reportAreasError) throw reportAreasError;

    if (!reportAreas || reportAreas.length === 0) {
      return NextResponse.json([]);
    }

    const reportAreaIds = (reportAreas as any[]).map((ra) => ra.id);

    // Get all monitoring reports for these report areas
    const { data, error } = await supabase
      .from('monitoring_area_report')
      .select(
        'id, sub_area:sub_areas(id, name, variety, rows, display), finding:findings(id, name, display_name:name), status'
      )
      .in('area_report_id', reportAreaIds)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Format for dropdown: sub-area name (key) + finding name (display)
    const formatted = data?.map((item: any) => ({
      id: item.id,
      key: item.sub_area?.display || item.sub_area?.name || '',
      display: `${item.sub_area?.name || ''} | ${item.finding?.name || ''}`,
      sub_area_id: item.sub_area?.id,
      finding_id: item.finding?.id,
      finding_name: item.finding?.name,
      status: item.status,
    }));

    return NextResponse.json(formatted);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
