import { NextResponse } from 'next/server';
import { getApiContext, requireWorkerAdminOrCustomer, resolveCustomerId } from '@/lib/api/auth-context';
import { handleApiError } from '@/lib/api-utils';
import { getAreasStatus } from '@/lib/services/area-status.service';

export async function GET(request: Request) {
  try {
    const ctx = await getApiContext();

    const authError = requireWorkerAdminOrCustomer(ctx);
    if (authError) return authError;

    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId') || resolveCustomerId(ctx);

    const areas = await getAreasStatus(ctx.supabase, {
      customerId,
      isAdmin: ctx.isAdmin,
    });

    return NextResponse.json({ areas });
  } catch (error) {
    if (error && typeof error === 'object' && 'digest' in error) {
      throw error;
    }
    return handleApiError(error);
  }
}
