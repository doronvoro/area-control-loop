import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { handleApiError } from '@/lib/api-utils';
import { getUnitTypes } from '@/lib/services/lookup.service';

export async function GET() {
  try {
    const supabase = await createClient();
    return NextResponse.json(await getUnitTypes(supabase));
  } catch (error) {
    return handleApiError(error);
  }
}
