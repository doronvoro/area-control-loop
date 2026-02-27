import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export async function GET() {
  try {
    await requireAuth();

    console.log('[Reports GET] Fetching report areas');

    const supabase = await createClient();

    const { data: reportAreas, error } = await supabase
      .from('report_areas')
      .select(
        `id, name, description, status, created_at, report_number,
        area_type:report_area_types(name, display_name),
        area:areas(id, name),
        worker:workers(id, name)`
      )
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    console.log('[Reports GET] Fetched report areas:', reportAreas?.length ?? 0);

    return NextResponse.json(reportAreas || []);
  } catch (error: any) {
    console.error('[Reports GET] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
