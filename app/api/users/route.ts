import { createAdminClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { hasRole } from '@/lib/permissions';

export async function GET() {
  try {
    await requireAuth();

    const isAdmin = await hasRole('admin');
    if (!isAdmin) {
      return NextResponse.json({ error: 'אין הרשאה לצפות במשתמשים' }, { status: 403 });
    }

    const adminClient = createAdminClient();
    const { data, error } = await adminClient.auth.admin.listUsers();

    if (error) throw error;

    // Map to simplified user objects
    const users = (data?.users || []).map((user) => ({
      id: user.id,
      email: user.email,
      name: user.user_metadata?.name || user.email,
      created_at: user.created_at,
    }));

    return NextResponse.json(users);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
