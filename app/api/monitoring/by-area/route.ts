import { NextResponse } from 'next/server';
import { getApiContext } from '@/lib/api/auth-context';
import { handleApiError } from '@/lib/api-utils';
import { ENTIRE_AREA_DISPLAY } from '@/lib/constants';

export async function GET(request: Request) {
  try {
    const ctx = await getApiContext();
    const { searchParams } = new URL(request.url);
    const areaId = searchParams.get('areaId');

    console.log('[Monitoring by-area GET] areaId:', areaId);

    if (!areaId) {
      return NextResponse.json(
        { error: 'areaId is required' },
        { status: 400 }
      );
    }

    // Get all report areas for this area
    const { data: reportAreas, error: reportAreasError } = await ctx.supabase
      .from('report_areas')
      .select('id')
      .eq('area_id', areaId);

    if (reportAreasError) throw reportAreasError;

    if (!reportAreas || reportAreas.length === 0) {
      return NextResponse.json([]);
    }

    const reportAreaIds = (reportAreas as any[]).map((ra) => ra.id);

    // Get all monitoring reports for these report areas
    const { data, error } = await ctx.supabase
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
      key: item.sub_area?.display || item.sub_area?.name || ENTIRE_AREA_DISPLAY,
      display: `${item.sub_area?.name || ENTIRE_AREA_DISPLAY} | ${item.finding?.name || ''}`,
      sub_area_id: item.sub_area?.id ?? null,
      finding_id: item.finding?.id,
      finding_name: item.finding?.name,
      status: item.status,
    }));

    console.log('[Monitoring by-area GET] Fetched monitoring reports:', formatted?.length ?? 0);

    return NextResponse.json(formatted);
  } catch (error) {
    console.error('[Monitoring by-area GET] Error:', error instanceof Error ? error.message : error);
    return handleApiError(error);
  }
}
