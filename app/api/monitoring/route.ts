import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getCurrentWorker, requireAuth } from '@/lib/auth';
import { hasRole } from '@/lib/permissions';

export async function GET() {
  try {
    await requireAuth();
    const supabase = await createClient();
    const worker = await getCurrentWorker();
    const isAdmin = await hasRole('admin');

    if (!worker && !isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('monitoring_area_report')
      .select(
        '*, area_report:report_areas(*), sub_area:sub_areas(*), finding:findings(*), recommend_unit_type:unit_types(*), recommend_action_type:action_types(*)'
      )
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAuth();
    const supabase = await createClient();
    const worker = await getCurrentWorker();
    const isAdmin = await hasRole('admin');

    if (!worker && !isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      // New form fields
      customer_id,
      inspector_id,
      area_id,
      // Old/common fields
      area_report_id: providedAreaReportId,
      sub_area_id,
      finding_id,
      recommend_material_id,
      recommend_dosage,
      recommend_unit_type_id,
      recommend_action_type_id,
      status = 'pending',
    } = body;

    // Determine area_report_id - either provided directly or we need to find/create one
    let finalAreaReportId = providedAreaReportId;

    if (!finalAreaReportId && area_id) {
      // Try to find an existing monitoring report_area for this area
      const { data: existingReportArea } = await (supabase
        .from('report_areas') as any)
        .select('id')
        .eq('area_id', area_id)
        .eq('type', 'monitoring')
        .maybeSingle();

      if (existingReportArea) {
        finalAreaReportId = existingReportArea.id;
      } else {
        // Create a new report_area for this area
        const { data: areaData } = await (supabase
          .from('areas') as any)
          .select('name')
          .eq('id', area_id)
          .single();

        const { data: newReportArea, error: createError } = await (supabase
          .from('report_areas') as any)
          .insert({
            area_id,
            type: 'monitoring',
            name: `דוח ניטור - ${areaData?.name || 'אזור'}`,
            description: `דוח ניטור`,
          })
          .select()
          .single();

        if (createError) throw createError;
        finalAreaReportId = newReportArea.id;
      }
    }

    if (!finalAreaReportId) {
      return NextResponse.json({ error: 'area_id or area_report_id is required' }, { status: 400 });
    }

    // Parse dosage to number if it's a string
    const parsedDosage = recommend_dosage
      ? (typeof recommend_dosage === 'string' ? parseFloat(recommend_dosage) : recommend_dosage)
      : null;

    const { data, error } = await (supabase
      .from('monitoring_area_report') as any)
      .insert({
        area_report_id: finalAreaReportId,
        sub_area_id,
        finding_id,
        recommend_material_id: recommend_material_id || null,
        recommend_dosage: parsedDosage,
        recommend_unit_type_id: recommend_unit_type_id || null,
        recommend_action_type_id: recommend_action_type_id || null,
        status: status || 'pending',
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
