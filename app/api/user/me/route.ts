import { NextResponse } from 'next/server';
import { getApiContext, resolveCustomerId } from '@/lib/api/auth-context';
import { handleApiError } from '@/lib/api-utils';
import { getAccessibleAreaIds } from '@/lib/services/customer-area.service';
import { OLIVE_CROP_NAME } from '@/lib/olive/constants';

/**
 * Does this user have any olive areas?
 *
 * Gating the olive nav on crop rather than on a customer id means the next
 * olive grower needs no code change. This only hides links — page-level
 * requireAuth and RLS remain the actual enforcement.
 */
async function hasOliveAreas(ctx: Awaited<ReturnType<typeof getApiContext>>): Promise<boolean> {
  const areaIds = await getAccessibleAreaIds(ctx.supabase, ctx.isAdmin, resolveCustomerId(ctx));
  if (areaIds.length === 0) return false;

  const { data } = await (ctx.supabase.from('areas') as any)
    .select('id, crops!inner(name)')
    .in('id', areaIds)
    .eq('crops.name', OLIVE_CROP_NAME)
    .limit(1);

  return (data || []).length > 0;
}

export async function GET() {
  try {
    const ctx = await getApiContext();

    const nameFromMetadata = ctx.user.user_metadata?.name || ctx.user.email?.split('@')[0] || '';

    const [rolesResult, olive] = await Promise.all([
      (ctx.supabase.from('user_roles') as any).select('roles(name, display_name)').eq('user_id', ctx.user.id),
      hasOliveAreas(ctx),
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
      features: { olive },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
