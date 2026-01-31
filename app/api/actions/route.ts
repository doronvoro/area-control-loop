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
      .from('actions_area_report')
      .select(
        '*, area_report:report_areas(*), sub_area:sub_areas(*), finding:findings(*), unit_type:unit_types(*), action_type:action_types(*)'
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
      area_report_id,
      sub_area_id,
      finding_id,
      material,
      dosage,
      unit_type_id,
      action_type_id,
      action_time,
      status = 'planned',
      notes,
      monitoring_report_id,
      update_monitoring_status,
    } = body;

    // Create action report
    const { data: actionData, error: actionError } = await supabase
      .from('actions_area_report')
      .insert({
        area_report_id,
        sub_area_id,
        finding_id,
        material: material || null,
        dosage: dosage || null,
        unit_type_id: unit_type_id || null,
        action_type_id: action_type_id || null,
        action_time: action_time || null,
        status: status || 'planned',
        notes: notes || null,
      } as any)
      .select()
      .single();

    if (actionError) throw actionError;

    // If linked to monitoring report, update it
    if (monitoring_report_id && actionData) {
      const updateData: any = {
        actions_area_report_id: (actionData as any).id,
      };

      if (update_monitoring_status) {
        updateData.status = update_monitoring_status;
      }

      const query = supabase.from('monitoring_area_report') as any;
      const { error: monitoringError } = await query
        .update(updateData)
        .eq('id', monitoring_report_id);

      if (monitoringError) throw monitoringError;
    }

    return NextResponse.json(actionData, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
