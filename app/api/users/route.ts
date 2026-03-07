import { NextResponse } from 'next/server';
import { getApiContext } from '@/lib/api/auth-context';
import { handleApiError } from '@/lib/api-utils';

export async function GET() {
  try {
    const ctx = await getApiContext();
    if (!ctx.isAdmin) {
      return NextResponse.json({ error: 'אין הרשאה לצפות במשתמשים' }, { status: 403 });
    }

    const { data, error } = await ctx.adminClient.auth.admin.listUsers();
    if (error) throw error;

    const users = (data?.users || []).map((user) => ({
      id: user.id,
      email: user.email,
      name: user.user_metadata?.name || user.email,
      created_at: user.created_at,
    }));

    return NextResponse.json(users);
  } catch (error) {
    return handleApiError(error);
  }
}
