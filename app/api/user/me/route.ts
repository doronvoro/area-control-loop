import { NextResponse } from 'next/server';
import { getApiContext } from '@/lib/api/auth-context';
import { handleApiError } from '@/lib/api-utils';

export async function GET() {
  try {
    const ctx = await getApiContext();

    const nameFromMetadata = ctx.user.user_metadata?.name || ctx.user.email?.split('@')[0] || '';

    const [rolesResult] = await Promise.all([
      (ctx.supabase.from('user_roles') as any).select('roles(name, display_name)').eq('user_id', ctx.user.id),
    ]);

    let displayName = nameFromMetadata;
    if (ctx.customer?.name) displayName = ctx.customer.name;
    else if (ctx.worker?.name) displayName = ctx.worker.name;

    const roles = rolesResult.data || [];
    const roleNames = roles.map((ur: any) => ur.roles?.display_name || ur.roles?.name).filter(Boolean);
    const userRole = roleNames.length > 0 ? roleNames.join(', ') : 'ללא תפקיד';

    const isCustomerOwner = roles.some((ur: any) => ur.roles?.name === 'customer_owner');

    return NextResponse.json({
      name: displayName,
      email: ctx.user.email,
      role: userRole,
      isAdmin: ctx.isAdmin,
      isCustomerOwner,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
