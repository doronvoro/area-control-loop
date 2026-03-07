import { NextResponse } from 'next/server';
import { getApiContext } from '@/lib/api/auth-context';
import { handleApiError } from '@/lib/api-utils';

function requireAdmin(ctx: { isAdmin: boolean }) {
  if (!ctx.isAdmin) {
    return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 });
  }
  return null;
}

export async function GET() {
  try {
    const ctx = await getApiContext();
    const forbidden = requireAdmin(ctx);
    if (forbidden) return forbidden;

    const { data, error } = await ctx.supabase.from('roles').select('*').order('name');
    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getApiContext();
    const forbidden = requireAdmin(ctx);
    if (forbidden) return forbidden;

    const body = await request.json();
    const { name, display_name, description } = body;

    if (!name || !display_name) {
      return NextResponse.json({ error: 'שם ושם תצוגה נדרשים' }, { status: 400 });
    }

    const { data, error } = await (ctx.adminClient.from('roles') as any)
      .insert({ name, display_name, description: description || null })
      .select()
      .single();

    if (error) {
      if (error.message.includes('duplicate')) {
        return NextResponse.json({ error: 'תפקיד עם שם זה כבר קיים' }, { status: 400 });
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
    const forbidden = requireAdmin(ctx);
    if (forbidden) return forbidden;

    const body = await request.json();
    const { id, name, display_name, description } = body;

    if (!id || !name || !display_name) {
      return NextResponse.json({ error: 'id, שם ושם תצוגה נדרשים' }, { status: 400 });
    }

    const { data, error } = await (ctx.adminClient.from('roles') as any)
      .update({ name, display_name, description: description || null, updated_at: new Date().toISOString() })
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
    const forbidden = requireAdmin(ctx);
    if (forbidden) return forbidden;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'id נדרש' }, { status: 400 });

    const { error } = await (ctx.adminClient.from('roles') as any).delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
