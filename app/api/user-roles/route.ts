import { createClient, createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { hasRole } from '@/lib/permissions';

export async function GET() {
  try {
    await requireAuth();

    const isAdmin = await hasRole('admin');
    if (!isAdmin) {
      return NextResponse.json({ error: 'אין הרשאה לצפות בהקצאות תפקידים' }, { status: 403 });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('user_roles')
      .select('*, roles(*)');

    if (error) throw error;

    // Fetch user emails using admin client
    const adminClient = createAdminClient();
    const userRolesWithEmail = await Promise.all(
      (data || []).map(async (userRole: any) => {
        const { data: userData } = await adminClient.auth.admin.getUserById(userRole.user_id);
        return {
          ...userRole,
          email: userData?.user?.email || null,
          user_name: userData?.user?.user_metadata?.name || userData?.user?.email || null,
        };
      })
    );

    return NextResponse.json(userRolesWithEmail);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAuth();

    const isAdmin = await hasRole('admin');
    if (!isAdmin) {
      return NextResponse.json({ error: 'אין הרשאה להקצות תפקיד' }, { status: 403 });
    }

    const body = await request.json();
    const { user_id, role_id } = body;

    if (!user_id || !role_id) {
      return NextResponse.json({ error: 'משתמש ותפקיד נדרשים' }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const { data, error } = await (adminClient.from('user_roles') as any)
      .insert({
        user_id,
        role_id,
      })
      .select('*, roles(*)')
      .single();

    if (error) {
      if (error.message.includes('duplicate')) {
        return NextResponse.json({ error: 'למשתמש כבר יש תפקיד זה' }, { status: 400 });
      }
      throw error;
    }

    // Get user email
    const { data: userData } = await adminClient.auth.admin.getUserById(user_id);

    return NextResponse.json({
      ...data,
      email: userData?.user?.email || null,
      user_name: userData?.user?.user_metadata?.name || userData?.user?.email || null,
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAuth();

    const isAdmin = await hasRole('admin');
    if (!isAdmin) {
      return NextResponse.json({ error: 'אין הרשאה להסיר תפקיד ממשתמש' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id נדרש' }, { status: 400 });
    }

    const adminClient = createAdminClient();
    const { error } = await (adminClient.from('user_roles') as any).delete().eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
