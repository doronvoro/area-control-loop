import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { hasRole } from '@/lib/permissions';

export async function GET(request: Request) {
  try {
    await requireAuth();

    const isAdmin = await hasRole('admin');
    if (!isAdmin) {
      return NextResponse.json({ error: 'אין הרשאה לצפות בהרשאות תפקידים' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const roleId = searchParams.get('roleId');

    const supabase = await createClient();
    let query = supabase
      .from('role_permissions')
      .select('*, roles(*), permissions(*)');

    if (roleId) {
      query = query.eq('role_id', roleId);
    }

    const { data, error } = await query;

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
      return NextResponse.json({ error: 'אין הרשאה להקצות הרשאה לתפקיד' }, { status: 403 });
    }

    const body = await request.json();
    const { role_id, permission_id } = body;

    if (!role_id || !permission_id) {
      return NextResponse.json({ error: 'תפקיד והרשאה נדרשים' }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const { data, error } = await (adminClient.from('role_permissions') as any)
      .insert({
        role_id,
        permission_id,
      })
      .select('*, roles(*), permissions(*)')
      .single();

    if (error) {
      if (error.message.includes('duplicate')) {
        return NextResponse.json({ error: 'לתפקיד כבר יש הרשאה זו' }, { status: 400 });
      }
      throw error;
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAuth();

    const isAdmin = await hasRole('admin');
    if (!isAdmin) {
      return NextResponse.json({ error: 'אין הרשאה להסיר הרשאה מתפקיד' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id נדרש' }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const { error } = await (adminClient.from('role_permissions') as any).delete().eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
