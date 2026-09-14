import { NextResponse } from 'next/server';
import {
  getApiContext,
  requireWorkerAdminOrCustomer,
  resolveCustomerId,
} from '@/lib/api/auth-context';
import { handleApiError } from '@/lib/api-utils';
import { getAccessibleAreaIds } from '@/lib/services/customer-area.service';
import { getOlivePlots, getHarvestedAreaIds } from '@/lib/services/olive-plot.service';
import { getLatestNirByArea } from '@/lib/services/olive-nir.service';
import { getYieldEstimatesBySeason } from '@/lib/services/olive-yield.service';
import { getWeatherDays } from '@/lib/services/olive-weather.service';
import {
  getParameterRules,
  getCategoryThresholds,
  getVarietyWindows,
  getActiveSeason,
} from '@/lib/services/olive-config.service';

/**
 * Everything the olive dashboard needs, in one round-trip.
 *
 * Follows the /api/monitoring/form-data precedent. Status is deliberately NOT
 * computed here: the client runs lib/olive/logic.ts over this payload, so there
 * is exactly one implementation of the harvest rules and it is the one covered
 * by the golden tests.
 */
export async function GET(request: Request) {
  try {
    const ctx = await getApiContext();
    const unauthorized = requireWorkerAdminOrCustomer(ctx);
    if (unauthorized) return unauthorized;

    const { searchParams } = new URL(request.url);
    const customerId = resolveCustomerId(ctx, searchParams.get('customerId'));
    const areaIds = await getAccessibleAreaIds(ctx.supabase, ctx.isAdmin, customerId);

    if (areaIds.length === 0) {
      // The threshold config still comes back. It belongs to no customer, and
      // the settings dialog reads both sets straight out of this payload — blank
      // them here and an admin with no customer selected opens the dialog to an
      // empty alert tab. Two small global lookups, no area scan.
      const [parameterRules, categoryThresholds] = await Promise.all([
        getParameterRules(ctx.supabase),
        getCategoryThresholds(ctx.supabase),
      ]);

      return NextResponse.json({
        plots: [],
        latestNir: {},
        yieldEstimates: {},
        harvestedAreaIds: [],
        parameterRules,
        categoryThresholds,
        varietyWindows: [],
        weatherDays: [],
        season: null,
      });
    }

    // Weather only matters looking forward — the logic ignores past days anyway.
    const today = new Date();
    const fromDate = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0'),
    ].join('-');

    const [
      plots,
      latestNir,
      harvestedAreaIds,
      parameterRules,
      categoryThresholds,
      varietyWindows,
      weatherDays,
      season,
    ] = await Promise.all([
      getOlivePlots(ctx.supabase, areaIds),
      getLatestNirByArea(ctx.supabase, areaIds),
      getHarvestedAreaIds(ctx.supabase, areaIds),
      getParameterRules(ctx.supabase),
      getCategoryThresholds(ctx.supabase),
      getVarietyWindows(ctx.supabase),
      getWeatherDays(ctx.supabase, fromDate),
      getActiveSeason(ctx.supabase),
    ]);

    const yieldEstimates = season
      ? await getYieldEstimatesBySeason(ctx.supabase, (season as any).id, areaIds)
      : {};

    return NextResponse.json({
      plots,
      latestNir,
      yieldEstimates,
      harvestedAreaIds,
      parameterRules,
      categoryThresholds,
      varietyWindows,
      weatherDays,
      season,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
