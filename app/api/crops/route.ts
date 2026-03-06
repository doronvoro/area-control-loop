import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { hasRole } from '@/lib/permissions';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from('crops')
      .select('*')
      .order('name');

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();
    const [isAdmin, isCustomerOwner] = await Promise.all([
      hasRole('admin'),
      hasRole('customer_owner'),
    ]);
    if (!isAdmin && !isCustomerOwner) {
      return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, parent_crop_id } = body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json({ error: 'שם גידול נדרש' }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const { data, error } = await (adminClient.from('crops') as any)
      .insert({ name: name.trim(), description: description?.trim() || null, parent_crop_id: parent_crop_id || null })
      .select()
      .single();

    if (error) {
      if (error.message.includes('duplicate')) {
        return NextResponse.json({ error: 'גידול עם שם זה כבר קיים' }, { status: 400 });
      }
      throw error;
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAuth();
    const [isAdmin, isCustomerOwner] = await Promise.all([
      hasRole('admin'),
      hasRole('customer_owner'),
    ]);
    if (!isAdmin && !isCustomerOwner) {
      return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 });
    }

    const body = await request.json();
    const { id, name, description, parent_crop_id } = body;

    if (!id) {
      return NextResponse.json({ error: 'מזהה גידול נדרש' }, { status: 400 });
    }

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json({ error: 'שם גידול נדרש' }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const { data, error } = await (adminClient.from('crops') as any)
      .update({ name: name.trim(), description: description?.trim() || null, parent_crop_id: parent_crop_id || null })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAuth();
    const [isAdmin, isCustomerOwner] = await Promise.all([
      hasRole('admin'),
      hasRole('customer_owner'),
    ]);
    if (!isAdmin && !isCustomerOwner) {
      return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'מזהה גידול נדרש' }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const { error } = await (adminClient.from('crops') as any).delete().eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
