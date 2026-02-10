import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();

    const { id } = await params;
    const supabase = await createClient();

    // Fetch the main report area data
    const { data: reportArea, error: reportError } = await supabase
      .from('report_areas')
      .select(
        `id, name, description, status, created_at, report_number, area_type_id,
        area_type:report_area_types(name, display_name),
        area:areas(id, name, description),
        worker:workers(id, name)`
      )
      .eq('id', id)
      .single();

    if (reportError) throw reportError;
    if (!reportArea) {
      return NextResponse.json({ error: 'דוח לא נמצא' }, { status: 404 });
    }

    // Fetch monitoring entries if this is a monitoring report
    let monitoringEntries = null;
    if (reportArea.area_type_id === 'monitoring') {
      const { data, error } = await supabase
        .from('monitoring_area_report')
        .select(
          `id, severity, created_at,
          sub_area:sub_areas(id, name, display),
          finding:findings(id, name, description),
          treatments:monitoring_treatments(
            id, dosage, notes, status,
            material:materials(id, name),
            unit_type:unit_types(id, name),
            action_type:action_types(id, name)
          )`
        )
        .eq('area_report_id', id);

      if (error) throw error;
      monitoringEntries = data;
    }

    // Fetch action entries if this is an action report
    let actionEntries = null;
    if (reportArea.area_type_id === 'action') {
      const { data, error } = await supabase
        .from('actions_area_report')
        .select(
          `id, severity, created_at,
          sub_area:sub_areas(id, name, display),
          finding:findings(id, name, description),
          treatments:action_treatments(
            id, dosage, notes, status, action_time,
            material:materials(id, name),
            unit_type:unit_types(id, name),
            action_type:action_types(id, name)
          )`
        )
        .eq('area_report_id', id);

      if (error) throw error;
      actionEntries = data;
    }

    return NextResponse.json({
      ...reportArea,
      monitoringEntries,
      actionEntries,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
