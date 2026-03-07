import { NextResponse } from 'next/server';
import { getApiContext } from '@/lib/api/auth-context';
import { handleApiError } from '@/lib/api-utils';

export async function GET(request: Request) {
  try {
    const ctx = await getApiContext();

    if (!ctx.isAdmin) {
      return NextResponse.json({ error: 'אין הרשאה לצפות בהרשאות תפקידים' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const roleId = searchParams.get('roleId');

    let query = ctx.supabase
      .from('role_permissions')
      .select('*, roles(*), permissions(*)');

    if (roleId) {
      query = query.eq('role_id', roleId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getApiContext();

    if (!ctx.isAdmin) {
      return NextResponse.json({ error: 'אין הרשאה להקצות הרשאה לתפקיד' }, { status: 403 });
    }

    const body = await request.json();
    const { role_id, permission_id } = body;

    if (!role_id || !permission_id) {
      return NextResponse.json({ error: 'תפקיד והרשאה נדרשים' }, { status: 400 });
    }

    const { data, error } = await (ctx.adminClient.from('role_permissions') as any)
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
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const ctx = await getApiContext();

    if (!ctx.isAdmin) {
      return NextResponse.json({ error: 'אין הרשאה להסיר הרשאה מתפקיד' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id נדרש' }, { status: 400 });
    }

    const { error } = await (ctx.adminClient.from('role_permissions') as any).delete().eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
