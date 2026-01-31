import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { hasRole } from '@/lib/permissions';

export async function GET(request: Request) {
  try {
    await requireAuth();
    const isAdmin = await hasRole('admin');

    if (!isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const areaId = searchParams.get('areaId');
    const includeProcessed = searchParams.get('includeProcessed') === 'true';

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

    // Build the query for monitoring reports with full details
    let query = supabase
      .from('monitoring_area_report')
      .select(`
        id,
        sub_area_id,
        finding_id,
        recommend_action_type_id,
        recommend_material_id,
        recommend_dosage,
        recommend_unit_type_id,
        actions_area_report_id,
        status,
        sub_areas!inner (
          id,
          name,
          display,
          crop_id,
          areas!inner (
            id,
            name,
            crop_id
          )
        ),
        findings!inner (
          id,
          name,
          description
        ),
        action_types (
          id,
          name,
          description
        ),
        materials (
          id,
          name,
          description
        ),
        unit_types (
          id,
          name,
          description
        )
      `)
      .in('area_report_id', reportAreaIds)
      .order('created_at', { ascending: false });

    // By default, only get reports without linked actions
    if (!includeProcessed) {
      query = query.is('actions_area_report_id', null);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Format for the actions form
    const formatted = data?.map((item: any) => {
      const subArea = item.sub_areas;
      const area = subArea?.areas;
      const effectiveCropId = subArea?.crop_id || area?.crop_id;

      return {
        monitoring_report_id: item.id,
        sub_area_id: item.sub_area_id,
        sub_area_display: subArea?.display || subArea?.name || '',
        sub_area_name: subArea?.name || '',
        finding_id: item.finding_id,
        finding_name: item.findings?.name || '',
        finding_description: item.findings?.description || '',
        recommend_action_type_id: item.recommend_action_type_id,
        recommend_action_type_name: item.action_types?.description || item.action_types?.name || '',
        recommend_material_id: item.recommend_material_id,
        recommend_material_name: item.materials?.description || item.materials?.name || '',
        recommend_dosage: item.recommend_dosage,
        recommend_unit_type_id: item.recommend_unit_type_id,
        recommend_unit_type_name: item.unit_types?.description || item.unit_types?.name || '',
        status: item.status,
        already_has_action: item.actions_area_report_id !== null,
        effective_crop_id: effectiveCropId,
      };
    }) || [];

    return NextResponse.json(formatted);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
