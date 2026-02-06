import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

export async function GET() {
  try {
    await requireAuth();

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'לא מחובר' }, { status: 401 });
    }

    // Get user name from metadata
    const nameFromMetadata = user.user_metadata?.name || user.email?.split('@')[0] || '';

    // Try to get name from customer or worker table
    const [customerResult, workerResult, rolesResult] = await Promise.all([
      (supabase.from('customers') as any)
        .select('name')
        .eq('user_id', user.id)
        .maybeSingle(),
      (supabase.from('workers') as any)
        .select('name')
        .eq('user_id', user.id)
        .maybeSingle(),
      (supabase.from('user_roles') as any)
        .select('roles(name, display_name)')
        .eq('user_id', user.id),
    ]);

    // Determine the best name to display
    let displayName = nameFromMetadata;
    if (customerResult.data?.name) {
      displayName = customerResult.data.name;
    } else if (workerResult.data?.name) {
      displayName = workerResult.data.name;
    }

    // Get role information
    const roles = rolesResult.data || [];
    const roleNames = roles
      .map((ur: any) => ur.roles?.display_name || ur.roles?.name)
      .filter(Boolean);

    const userRole = roleNames.length > 0 ? roleNames.join(', ') : 'ללא תפקיד';

    // Check if admin
    const isAdmin = roles.some((ur: any) => ur.roles?.name === 'admin');

    return NextResponse.json({
      name: displayName,
      email: user.email,
      role: userRole,
      isAdmin,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
