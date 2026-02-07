import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { hasRole } from '@/lib/permissions';

export async function GET() {
  try {
    await requireAuth();

    const isAdmin = await hasRole('admin');
    if (!isAdmin) {
      return NextResponse.json({ error: 'אין הרשאה לצפות בתפקידים' }, { status: 403 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('roles')
      .select('*')
      .order('name');

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
      return NextResponse.json({ error: 'אין הרשאה ליצור תפקיד' }, { status: 403 });
    }

    const body = await request.json();
    const { name, display_name, description } = body;

    if (!name || !display_name) {
      return NextResponse.json({ error: 'שם ושם תצוגה נדרשים' }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const { data, error } = await (adminClient.from('roles') as any)
      .insert({
        name,
        display_name,
        description: description || null,
      })
      .select()
      .single();

    if (error) {
      if (error.message.includes('duplicate')) {
        return NextResponse.json({ error: 'תפקיד עם שם זה כבר קיים' }, { status: 400 });
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
      return NextResponse.json({ error: 'אין הרשאה לעדכן תפקיד' }, { status: 403 });
    }

    const body = await request.json();
    const { id, name, display_name, description } = body;

    if (!id || !name || !display_name) {
      return NextResponse.json({ error: 'id, שם ושם תצוגה נדרשים' }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const { data, error } = await (adminClient.from('roles') as any)
      .update({
        name,
        display_name,
        description: description || null,
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
      return NextResponse.json({ error: 'אין הרשאה למחוק תפקיד' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id נדרש' }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const { error } = await (adminClient.from('roles') as any).delete().eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
