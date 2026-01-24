import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const areaId = searchParams.get('areaId');
    const type = searchParams.get('type');

    const supabase = await createClient();
    let query = supabase.from('report_areas').select('*');

    if (id) {
      // Fetch single report area by ID
      const { data, error } = await query.eq('id', id).single();
      if (error) throw error;
      return NextResponse.json(data);
    }

    if (areaId) {
      query = query.eq('area_id', areaId);
    }

    if (type) {
      query = query.eq('type', type);
    }

    const { data, error } = await query.order('name');

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
