import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { hasRole } from '@/lib/permissions';

export async function GET() {
  try {
    await requireAuth();

    const isAdmin = await hasRole('admin');
    if (!isAdmin) {
      return NextResponse.json({ error: 'אין הרשאה לצפות בהרשאות' }, { status: 403 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('permissions')
      .select('*')
      .order('resource')
      .order('action');

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAuth();

    const isAdmin = await hasRole('admin');
    if (!isAdmin) {
      return NextResponse.json({ error: 'אין הרשאה ליצור הרשאה' }, { status: 403 });
    }

    const body = await request.json();
    const { name, display_name, description, resource, action } = body;

    if (!name || !display_name || !resource || !action) {
      return NextResponse.json({ error: 'שם, שם תצוגה, משאב ופעולה נדרשים' }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const { data, error } = await (adminClient.from('permissions') as any)
      .insert({
        name,
        display_name,
        description: description || null,
        resource,
        action,
      })
      .select()
      .single();

    if (error) {
      if (error.message.includes('duplicate')) {
        return NextResponse.json({ error: 'הרשאה עם שם זה כבר קיימת' }, { status: 400 });
      }
      throw error;
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    await requireAuth();

    const isAdmin = await hasRole('admin');
    if (!isAdmin) {
      return NextResponse.json({ error: 'אין הרשאה לעדכן הרשאה' }, { status: 403 });
    }

    const body = await request.json();
    const { id, name, display_name, description, resource, action } = body;

    if (!id || !name || !display_name || !resource || !action) {
      return NextResponse.json({ error: 'id, שם, שם תצוגה, משאב ופעולה נדרשים' }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const { data, error } = await (adminClient.from('permissions') as any)
      .update({
        name,
        display_name,
        description: description || null,
        resource,
        action,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAuth();

    const isAdmin = await hasRole('admin');
    if (!isAdmin) {
      return NextResponse.json({ error: 'אין הרשאה למחוק הרשאה' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id נדרש' }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const { error } = await (adminClient.from('permissions') as any).delete().eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
