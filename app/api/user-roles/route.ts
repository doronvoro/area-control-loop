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

    const { data, error } = await ctx.supabase.from('user_roles').select('*, roles(*)');
    if (error) throw error;

    const userRolesWithEmail = await Promise.all(
      (data || []).map(async (userRole: any) => {
        const { data: userData } = await ctx.adminClient.auth.admin.getUserById(userRole.user_id);
        return {
          ...userRole,
          email: userData?.user?.email || null,
          user_name: userData?.user?.user_metadata?.name || userData?.user?.email || null,
        };
      })
    );

    return NextResponse.json(userRolesWithEmail);
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
    const { user_id, role_id } = body;

    if (!user_id || !role_id) {
      return NextResponse.json({ error: 'משתמש ותפקיד נדרשים' }, { status: 400 });
    }

    const { data, error } = await (ctx.adminClient.from('user_roles') as any)
      .insert({ user_id, role_id })
      .select('*, roles(*)')
      .single();

    if (error) {
      if (error.message.includes('duplicate')) {
        return NextResponse.json({ error: 'למשתמש כבר יש תפקיד זה' }, { status: 400 });
      }
      throw error;
    }

    const { data: userData } = await ctx.adminClient.auth.admin.getUserById(user_id);

    return NextResponse.json({
      ...data,
      email: userData?.user?.email || null,
      user_name: userData?.user?.user_metadata?.name || userData?.user?.email || null,
    }, { status: 201 });
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

    const { error } = await (ctx.adminClient.from('user_roles') as any).delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error);
  }
}
