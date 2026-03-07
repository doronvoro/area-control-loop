import { NextResponse } from 'next/server';
import { getApiContext } from '@/lib/api/auth-context';
import { handleApiError } from '@/lib/api-utils';

export async function GET() {
  try {
    const ctx = await getApiContext();

    if (!ctx.isAdmin) {
      return NextResponse.json({ error: 'אין הרשאה לצפות בהרשאות' }, { status: 403 });
    }

    const { data, error } = await ctx.supabase
      .from('permissions')
      .select('*')
      .order('resource')
      .order('action');

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
      return NextResponse.json({ error: 'אין הרשאה ליצור הרשאה' }, { status: 403 });
    }

    const body = await request.json();
    const { name, display_name, description, resource, action } = body;

    if (!name || !display_name || !resource || !action) {
      return NextResponse.json({ error: 'שם, שם תצוגה, משאב ופעולה נדרשים' }, { status: 400 });
    }

    const { data, error } = await (ctx.adminClient.from('permissions') as any)
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
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const ctx = await getApiContext();

    if (!ctx.isAdmin) {
      return NextResponse.json({ error: 'אין הרשאה לעדכן הרשאה' }, { status: 403 });
    }

    const body = await request.json();
    const { id, name, display_name, description, resource, action } = body;

    if (!id || !name || !display_name || !resource || !action) {
      return NextResponse.json({ error: 'id, שם, שם תצוגה, משאב ופעולה נדרשים' }, { status: 400 });
    }

    const { data, error } = await (ctx.adminClient.from('permissions') as any)
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
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const ctx = await getApiContext();

    if (!ctx.isAdmin) {
      return NextResponse.json({ error: 'אין הרשאה למחוק הרשאה' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id נדרש' }, { status: 400 });
    }

    const { error } = await (ctx.adminClient.from('permissions') as any).delete().eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
