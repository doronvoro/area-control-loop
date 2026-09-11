import { NextResponse } from 'next/server';
import {
  getApiContext,
  requireWorkerAdminOrCustomer,
  resolveCustomerId,
} from '@/lib/api/auth-context';
import { handleApiError } from '@/lib/api-utils';
import { getAccessibleAreaIds } from '@/lib/services/customer-area.service';
import {
  getYieldEstimatesBySeason,
  upsertYieldEstimate,
  getHarvestTotalsByArea,
} from '@/lib/services/olive-yield.service';
import { getActiveSeason } from '@/lib/services/olive-config.service';

/**
 * Yield estimates for a season, plus what was actually harvested.
 *
 * Estimates and actuals are returned together because the yield screen exists to
 * compare them; totals are summed from harvest passes rather than stored.
 */
export async function GET(request: Request) {
  try {
    const ctx = await getApiContext();
    const unauthorized = requireWorkerAdminOrCustomer(ctx);
    if (unauthorized) return unauthorized;

    const { searchParams } = new URL(request.url);
    const customerId = resolveCustomerId(ctx, searchParams.get('customerId'));
    const areaIds = await getAccessibleAreaIds(ctx.supabase, ctx.isAdmin, customerId);

    let seasonId = searchParams.get('seasonId');
    if (!seasonId) {
      const season = await getActiveSeason(ctx.supabase);
      seasonId = (season as any)?.id ?? null;
    }

    const [estimates, actuals] = await Promise.all([
      seasonId ? getYieldEstimatesBySeason(ctx.supabase, seasonId, areaIds) : Promise.resolve({}),
      getHarvestTotalsByArea(ctx.supabase, areaIds),
    ]);

    return NextResponse.json({ seasonId, estimates, actuals });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const ctx = await getApiContext();
    const unauthorized = requireWorkerAdminOrCustomer(ctx);
    if (unauthorized) return unauthorized;

    const body = await request.json();
    const { area_id, season_id, kg_per_dunam } = body;

    if (!area_id || !season_id) {
      return NextResponse.json({ error: 'נדרשים מזהה חלקה ומזהה עונה' }, { status: 400 });
    }

    const customerId = resolveCustomerId(ctx, null);
    const areaIds = await getAccessibleAreaIds(ctx.supabase, ctx.isAdmin, customerId);
    if (!areaIds.includes(area_id)) {
      return NextResponse.json({ error: 'אין הרשאה לחלקה זו' }, { status: 403 });
    }

    const saved = await upsertYieldEstimate(ctx.adminClient, {
      areaId: area_id,
      seasonId: season_id,
      kgPerDunam: kg_per_dunam === '' || kg_per_dunam == null ? null : Number(kg_per_dunam),
    });

    return NextResponse.json(saved);
  } catch (error) {
    return handleApiError(error);
  }
}
