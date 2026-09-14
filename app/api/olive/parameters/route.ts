import { NextResponse } from 'next/server';
import { getApiContext, requireWorkerAdminOrCustomer } from '@/lib/api/auth-context';
import { handleApiError } from '@/lib/api-utils';
import { getParameters, getParameterRules } from '@/lib/services/olive-config.service';

/**
 * The parameter bands on their own.
 *
 * Any screen that scores a measurement needs parameter_rules, and until now the
 * only way to get them was /api/olive/dashboard — seven-plus parallel queries,
 * including an unbounded scan of every NIR report, to read one small lookup
 * table. The NIR form was paying exactly that.
 *
 * No customer scoping: parameters and their rules are global (RLS on both is
 * "Anyone can read"), which is also why this can be browser-cached.
 */
export async function GET() {
  try {
    const ctx = await getApiContext();
    const unauthorized = requireWorkerAdminOrCustomer(ctx);
    if (unauthorized) return unauthorized;

    const [parameters, parameterRules] = await Promise.all([
      getParameters(ctx.supabase),
      getParameterRules(ctx.supabase),
    ]);

    return NextResponse.json(
      { parameters, parameterRules },
      // Private: the response is identical for every user, but the request is
      // cookie-authenticated, so it must not land in a shared cache.
      { headers: { 'Cache-Control': 'private, max-age=300' } }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
