import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export async function GET() {
  try {
    await requireAuth();

    const supabase = await createClient();

    // Fetch report_areas with area_type and area - simplified query
    const { data: reportAreas, error } = await supabase
      .from('report_areas')
      .select(
        `id, name, description, status, created_at, report_number,
        area_type:area_types(id, name, display_name),
        area:areas(id, name)`
      )
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    return NextResponse.json(reportAreas || []);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
