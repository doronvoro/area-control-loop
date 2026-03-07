import { NextResponse } from 'next/server';
import { getApiContext } from '@/lib/api/auth-context';
import { handleApiError } from '@/lib/api-utils';
import { ENTIRE_AREA_DISPLAY } from '@/lib/constants';

export async function GET(request: Request) {
  try {
    const ctx = await getApiContext();

    if (!ctx.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const areaId = searchParams.get('areaId');
    const includeProcessed = searchParams.get('includeProcessed') === 'true';

    console.log('[Monitoring by-area-for-actions GET] areaId:', areaId, 'includeProcessed:', includeProcessed);

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

    // Build the query for monitoring reports with full details including treatments
    let query = ctx.supabase
      .from('monitoring_area_report')
      .select(`
        id,
        sub_area_id,
        finding_id,
        actions_area_report_id,
        status,
        sub_areas (
          id,
          name,
          display,
          crop_id,
          areas (
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
        treatments:monitoring_treatments (
          id,
          material_id,
          dosage,
          unit_type_id,
          action_type_id,
          status,
          notes,
          material:materials (
            id,
            name,
            description
          ),
          unit_type:unit_types (
            id,
            name,
            description
          )
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

    // Get area info for cases where sub_area_id is null (entire area)
    const { data: areaInfo } = await ctx.supabase
      .from('areas')
      .select('id, name, crop_id')
      .eq('id', areaId)
      .single();

    // Format for the actions form
    const formatted = data?.map((item: any) => {
      const subArea = item.sub_areas;
      const area = subArea?.areas || areaInfo;
      const effectiveCropId = subArea?.crop_id || area?.crop_id;

      // Filter out completed treatments - action workers only need to see non-completed ones
      const nonCompletedTreatments = (item.treatments || []).filter(
        (t: any) => t.status !== 'completed'
      );

      // Get the first non-completed treatment for backwards compatibility with forms
      const firstTreatment = nonCompletedTreatments[0];

      return {
        monitoring_report_id: item.id,
        sub_area_id: item.sub_area_id ?? null,
        sub_area_display: subArea?.display || subArea?.name || ENTIRE_AREA_DISPLAY,
        sub_area_name: subArea?.name || ENTIRE_AREA_DISPLAY,
        finding_id: item.finding_id,
        finding_name: item.findings?.name || '',
        finding_description: item.findings?.description || '',
        // Include first treatment data for backwards compatibility
        recommend_action_type_id: firstTreatment?.action_type_id || null,
        recommend_action_type_name: firstTreatment?.action_type?.description || firstTreatment?.action_type?.name || '',
        recommend_material_id: firstTreatment?.material_id || null,
        recommend_material_name: firstTreatment?.material?.description || firstTreatment?.material?.name || '',
        recommend_dosage: firstTreatment?.dosage || null,
        recommend_unit_type_id: firstTreatment?.unit_type_id || null,
        recommend_unit_type_name: firstTreatment?.unit_type?.description || firstTreatment?.unit_type?.name || '',
        // Include non-completed treatments array (with IDs for linking)
        treatments: nonCompletedTreatments,
        status: item.status,
        already_has_action: item.actions_area_report_id !== null,
        effective_crop_id: effectiveCropId,
      };
    }) || [];

    // Filter out monitoring reports that have no non-completed treatments
    const filteredFormatted = formatted.filter(
      (item: any) => item.treatments.length > 0 || !item.already_has_action
    );

    console.log('[Monitoring by-area-for-actions GET] Fetched:', filteredFormatted.length, 'reports');

    return NextResponse.json(filteredFormatted);
  } catch (error) {
    console.error('[Monitoring by-area-for-actions GET] Error:', error instanceof Error ? error.message : error);
    return handleApiError(error);
  }
}
