import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { getCurrentWorker, requireAuth } from '@/lib/auth';

export async function GET() {
  try {
    await requireAuth();
    const supabase = await createClient();
    const worker = await getCurrentWorker();

    if (!worker) {
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

    if (!worker) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      area_report_id,
      sub_area_id,
      finding_id,
      recommend_material,
      recommend_dosage,
      recommend_unit_type_id,
      recommend_action_type_id,
      status = 'pending',
    } = body;

    const { data, error } = await (supabase
      .from('monitoring_area_report') as any)
      .insert({
        area_report_id,
        sub_area_id,
        finding_id,
        recommend_material: recommend_material || null,
        recommend_dosage: recommend_dosage || null,
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
