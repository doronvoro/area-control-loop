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
  getWeatherThresholds,
  getVarietyWindows,
  getActiveSeason,
} from '@/lib/services/olive-config.service';

/**
 * Local YYYY-MM-DD. Weather only matters looking forward — the logic ignores
 * past days anyway — and toISOString() would shift the day across timezones.
 */
function todayString(): string {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

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
      // the settings dialog reads all three sets straight out of this payload —
      // blank them here and an admin with no customer selected opens the dialog
      // to an empty alert tab. Four small global lookups, no area scan.
      //
      // weatherDays is in that list for the same reason and not by accident:
      // the forecast is regional, weather_days carries no customer_id, and the
      // weather tab previews the edited levels against it. Blanked, that tab
      // would say "אין נתוני תחזית" to an admin who has a perfectly good
      // forecast loaded — a claim about the data rather than about the scope.
      const [parameterRules, categoryThresholds, weatherThresholds, weatherDays] =
        await Promise.all([
          getParameterRules(ctx.supabase),
          getCategoryThresholds(ctx.supabase),
          getWeatherThresholds(ctx.supabase),
          getWeatherDays(ctx.supabase, todayString()),
        ]);

      return NextResponse.json({
        plots: [],
        latestNir: {},
        yieldEstimates: {},
        harvestedAreaIds: [],
        parameterRules,
        categoryThresholds,
        varietyWindows: [],
        weatherDays,
        weatherThresholds,
        season: null,
      });
    }

    const fromDate = todayString();

    const [
      plots,
      latestNir,
      harvestedAreaIds,
      parameterRules,
      categoryThresholds,
      weatherThresholds,
      varietyWindows,
      weatherDays,
      season,
    ] = await Promise.all([
      getOlivePlots(ctx.supabase, areaIds),
      getLatestNirByArea(ctx.supabase, areaIds),
      getHarvestedAreaIds(ctx.supabase, areaIds),
      getParameterRules(ctx.supabase),
      getCategoryThresholds(ctx.supabase),
      getWeatherThresholds(ctx.supabase),
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
      weatherThresholds,
      season,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
