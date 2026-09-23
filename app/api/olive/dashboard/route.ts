import { NextResponse } from 'next/server';
import {
  getApiContext,
  requireWorkerAdminOrCustomer,
  resolveCustomerId,
} from '@/lib/api/auth-context';
import { handleApiError } from '@/lib/api-utils';
import { getAccessibleAreaIds } from '@/lib/services/customer-area.service';
import { getOlivePlots, getHarvestedAreaIds } from '@/lib/services/olive-plot.service';
import {
  getNirReports,
  getNirSeasonCounts,
  latestNirByArea,
  nirCountByAreaInSeason,
} from '@/lib/services/olive-nir.service';
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
        // Zeros rather than an absent key: an admin with no customer selected
        // should read "nothing to send", not crash the season card on undefined.
        nirCounts: { total: 0, unsent: 0 },
      });
    }

    const fromDate = todayString();

    const [
      plots,
      nirReports,
      harvestedAreaIds,
      parameterRules,
      categoryThresholds,
      weatherThresholds,
      varietyWindows,
      weatherDays,
      season,
    ] = await Promise.all([
      getOlivePlots(ctx.supabase, areaIds),
      // The rows, not the reduction: latestNir and the per-plot season count
      // below are two readings of this one fetch. Unbounded, for the reason
      // getNirReports documents — a season floor here would change what a plot
      // whose last reading is older than the season classifies as.
      getNirReports(ctx.supabase, areaIds),
      getHarvestedAreaIds(ctx.supabase, areaIds),
      getParameterRules(ctx.supabase),
      getCategoryThresholds(ctx.supabase),
      getWeatherThresholds(ctx.supabase),
      getVarietyWindows(ctx.supabase),
      getWeatherDays(ctx.supabase, fromDate),
      getActiveSeason(ctx.supabase),
    ]);

    const latestNir = latestNirByArea(nirReports);
    // Needs the season, so it waits for the batch above rather than joining it.
    // No query of its own: it counts the rows already in hand.
    const nirCountByArea = nirCountByAreaInSeason(nirReports, season);

    // Both need the resolved season, so they cannot join the batch above.
    const [yieldEstimates, nirCounts] = await Promise.all([
      season ? getYieldEstimatesBySeason(ctx.supabase, (season as any).id, areaIds) : {},
      // Counts, not rows: the card needs two numbers and the archive only grows.
      // Not derived from latestNir above — that holds one reading per plot, so a
      // plot sitting on four unsent readings would be counted once.
      getNirSeasonCounts(ctx.supabase, areaIds, season),
    ]);

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
      nirCounts,
      nirCountByArea,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
