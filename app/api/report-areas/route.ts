import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { hasRole } from '@/lib/permissions';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const areaId = searchParams.get('areaId');
    const typeName = searchParams.get('type'); // accepts type name for backward compat

    const supabase = await createClient();
    let query = supabase.from('report_areas').select('*, area_type:area_types(*)');

    if (id) {
      // Fetch single report area by ID
      const { data, error } = await query.eq('id', id).single();
      if (error) throw error;
      return NextResponse.json(data);
    }

    if (areaId) {
      query = query.eq('area_id', areaId);
    }

    if (typeName) {
      // Use typeName directly as area_type_id (name is the PK)
      query = query.eq('area_type_id', typeName);
    }

    const { data, error } = await query.order('name');

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAuth();

    // Only admins can create report areas directly
    const isAdmin = await hasRole('admin');
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'אין הרשאה ליצור אזור דוח' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { area_id, area_type_id, name, description } = body;

    if (!area_id || !area_type_id || !name) {
      return NextResponse.json(
        { error: 'area_id, area_type_id ו-name נדרשים' },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();
    const { data, error } = await (adminClient
      .from('report_areas') as any)
      .insert({
        area_id,
        area_type_id,
        name,
        description: description || null,
      })
      .select('*, area_type:area_types(*)')
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
