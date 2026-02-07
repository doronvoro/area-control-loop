import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export async function GET() {
  try {
    await requireAuth();

    const supabase = await createClient();

    // Fetch report_areas with their monitoring and action reports including treatments
    // Monitoring treatments include linked action_treatment for comparison view
    const { data: reportAreas, error } = await supabase
      .from('report_areas')
      .select(
        `id, name, type, description, created_at, report_number,
        area:areas(id, name),
        monitoring_reports:monitoring_area_report(
          id, status, created_at,
          sub_area:sub_areas(id, name),
          finding:findings(name, description),
          treatments:monitoring_treatments(
            id, dosage, status, notes,
            material:materials(id, name, description),
            action_type:action_types(id, name, description),
            unit_type:unit_types(id, name, description)
          )
        ),
        action_reports:actions_area_report(
          id, status, created_at,
          sub_area:sub_areas(id, name),
          finding:findings(name, description),
          treatments:action_treatments(
            id, dosage, status, notes, action_time,
            material:materials(id, name, description),
            action_type:action_types(id, name, description),
            unit_type:unit_types(id, name, description)
          )
        )`
      )
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    return NextResponse.json(reportAreas || []);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
