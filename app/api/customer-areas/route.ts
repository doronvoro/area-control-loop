import { createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { hasPermission } from '@/lib/permissions';

export async function POST(request: Request) {
  try {
    await requireAuth();

    // Check permission
    const canAssign = await hasPermission('add_area_to_customer');
    if (!canAssign) {
      return NextResponse.json({ error: 'אין הרשאה להקצאת שטח ללקוח' }, { status: 403 });
    }

    const body = await request.json();
    const { customer_id, area_id } = body;

    if (!customer_id || !area_id) {
      return NextResponse.json({ error: 'customer_id ו-area_id נדרשים' }, { status: 400 });
    }

    // Use admin client to bypass RLS (permissions already checked above)
    const adminClient = createAdminClient();

    // Check if assignment already exists
    const { data: existing } = await (adminClient
      .from('customer_areas') as any)
      .select('id')
      .eq('customer_id', customer_id)
      .eq('area_id', area_id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'השטח כבר משויך ללקוח זה' }, { status: 400 });
    }

    // Create the assignment
    const { data, error } = await (adminClient
      .from('customer_areas') as any)
      .insert({
        customer_id,
        area_id,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAuth();

    // Check permission
    const canRemove = await hasPermission('remove_area_from_customer');
    if (!canRemove) {
      return NextResponse.json({ error: 'אין הרשאה להסרת שטח מלקוח' }, { status: 403 });
    }

    const body = await request.json();
    const { customer_id, area_id } = body;

    if (!customer_id || !area_id) {
      return NextResponse.json({ error: 'customer_id ו-area_id נדרשים' }, { status: 400 });
    }

    // Use admin client to bypass RLS (permissions already checked above)
    const adminClient = createAdminClient();

    const { error } = await (adminClient
      .from('customer_areas') as any)
      .delete()
      .eq('customer_id', customer_id)
      .eq('area_id', area_id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    await requireAuth();

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');

    // Use admin client to get customer areas
    const adminClient = createAdminClient();

    let query = (adminClient
      .from('customer_areas') as any)
      .select('id, customer_id, area_id, areas(id, name, description, crop_id, crops(id, name, description)), customers(id, name)');

    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
