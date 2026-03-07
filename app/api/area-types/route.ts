import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { handleApiError } from '@/lib/api-utils';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('report_area_types')
      .select('*')
      .order('name');

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}
