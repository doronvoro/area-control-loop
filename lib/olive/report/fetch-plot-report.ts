/**
 * Everything the per-plot status report prints, in one call.
 *
 * Ported from the client prototype's generatePlotReport / buildReportHTML
 * (docs/code.html:6042 and :5926), which is the layout this reproduces.
 *
 * WHY A LOADER RATHER THAN AN API ROUTE
 * Two renderers need this data — the printable page and the PDF endpoint — and
 * one of them (the PDF) runs server-side with no browser to make a fetch. A
 * plain function both call keeps a single composition and means the two outputs
 * cannot disagree. It mirrors how app/api/olive/dashboard/route.ts assembles the
 * dashboard, with [areaId] in place of the full area list.
 *
 * NOTHING HERE DECIDES ANYTHING. Status, weather flags and thresholds all come
 * from lib/olive/logic.ts, so there stays exactly one implementation of the
 * harvest rules — the one the golden tests cover. This module only fetches,
 * flattens and formats.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { getOlivePlot } from '@/lib/services/olive-plot.service';
import { getNirReports } from '@/lib/services/olive-nir.service';
import { getHarvestReports } from '@/lib/services/olive-harvest.service';
import { getYieldEstimatesBySeason } from '@/lib/services/olive-yield.service';
import { getWeatherDays } from '@/lib/services/olive-weather.service';
import {
  getParameterRules,
  getVarietyWindows,
  getWeatherThresholds,
  getActiveSeason,
} from '@/lib/services/olive-config.service';

import {
  toWeatherDayLike,
  toWeatherThresholds,
  toVarietyWindowLike,
  toPlotLike,
  toNirLike,
  type ApiPlot,
  type ApiNirReport,
} from '@/lib/olive/adapt';
import {
  computeUpcomingWeather,
  computePlotStatus,
  evaluateParameter,
  daysSinceLabel,
  yieldLoadInfo,
  type UrgencyLevel,
} from '@/lib/olive/logic';
import { toNirRow, type NirRow } from '@/lib/olive/nir-rows';
import { toHarvestRow } from '@/lib/olive/harvest-rows';
import { buildRecommendation } from '@/lib/olive/report/recommendation';
import {
  ParameterStatus,
  HARVESTER_LABELS,
  WATER_TYPE_LABELS,
  PLOT_TYPE_LABELS,
  type ParameterRule,
  type HarvesterType,
  type WaterType,
  type PlotType,
} from '@/types/database';

// --- Types ---

export interface ReportKpi {
  label: string;
  /** Already formatted, or '—'. */
  value: string;
  unit?: string;
  /** '' | 'flag-ok' | 'flag-plan' | 'flag-urgent' */
  flagClass: string;
}

export interface ReportTag {
  label: string;
  value: string;
}

export interface HarvestTotals {
  passes: number;
  fruitKg: number | null;
  oilKg: number | null;
  areaDoneDunam: number | null;
  fruitPerDunam: number | null;
  oilPerDunam: number | null;
  oilPercent: number | null;
}

export interface PlotReportData {
  /** he-IL date + time, formatted once here so both renderers agree. */
  generatedAt: string;
  seasonLabel: string | null;

  plotName: string;
  growerName: string;
  variety: string | null;
  region: string | null;
  plantYear: string | null;
  maturityLabel: string;
  sizeDunam: number | null;

  tags: ReportTag[];

  status: { level: UrgencyLevel; headline: string; windowLine: string };
  recommendation: string;
  weatherLines: string[];

  latest: NirRow | null;
  latestDateLabel: string | null;
  kpis: ReportKpi[];
  /** Measurements with no threshold band of their own. */
  subValues: ReportTag[];

  /** Oldest first — the order the chart and the table both want. */
  history: NirRow[];
  harvest: HarvestTotals | null;
}

// --- Helpers ---

/**
 * Local YYYY-MM-DD. Copied from app/api/olive/dashboard/route.ts:25 rather than
 * shared, for the reason stated there: toISOString() shifts the day across
 * timezones, and the forecast only matters looking forward.
 */
function todayString(now: Date): string {
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

/**
 * The prototype's nirFlagClass (docs/code.html:5877), over the port's statuses.
 * `idle` is deliberately unflagged: a reading below every band is not a finding.
 */
function flagClass(status: ParameterStatus | null | undefined): string {
  switch (status) {
    case ParameterStatus.URGENT:
      return 'flag-urgent';
    case ParameterStatus.PLAN:
      return 'flag-plan';
    case ParameterStatus.OK:
      return 'flag-ok';
    default:
      return '';
  }
}

function fmt(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  // Trim a trailing .0 so 12.0 prints as 12, matching the prototype's raw echo.
  const fixed = value.toFixed(digits);
  return fixed.endsWith('.0') ? fixed.slice(0, -2) : fixed;
}

function numeric(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * The prototype's plotAge/maturity pair (docs/code.html:4624 and :5929).
 * parseInt is what it used, and it is what makes a '2006/7' label yield 2006.
 */
function maturityLabel(plantYear: string | null, now: Date): string {
  if (!plantYear) return '—';
  const year = parseInt(plantYear, 10);
  if (!year) return '—';
  return now.getFullYear() - year > 5 ? 'בוגר' : 'צעיר';
}

// --- Public API ---

/**
 * Returns null when the plot is invisible to this caller or is not an olive
 * area — both of which the callers turn into a 404.
 *
 * Tenancy needs no explicit check: `supabase` is the RLS-scoped client and
 * getOlivePlot additionally filters on the olive crop, so a plot belonging to
 * another tenant simply does not come back. Do not add a
 * requireWorkerAdminOrCustomer() call here — it returns a NextResponse, which a
 * page cannot render.
 */
export async function fetchPlotReport(
  supabase: SupabaseClient,
  areaId: string,
  now: Date
): Promise<PlotReportData | null> {
  const plot = (await getOlivePlot(supabase, areaId)) as ApiPlot | null;
  if (!plot) return null;

  const season = (await getActiveSeason(supabase)) as {
    id: string;
    name: string;
    year_type: string | null;
    starts_on: string;
    ends_on: string;
  } | null;

  // The season bounds the report: "the current cycle" is what the customer is
  // being told about. With no active season we fall back to the whole archive
  // rather than showing nothing.
  const range = season ? { from: season.starts_on, to: season.ends_on } : {};

  const [nirReports, harvestReports, rules, windowRows, weatherRow, weatherRows] =
    await Promise.all([
      getNirReports(supabase, [areaId], range),
      getHarvestReports(supabase, [areaId], range),
      getParameterRules(supabase),
      getVarietyWindows(supabase),
      getWeatherThresholds(supabase),
      getWeatherDays(supabase, todayString(now)),
    ]);

  const yieldEstimates = season
    ? await getYieldEstimatesBySeason(supabase, season.id, [areaId])
    : {};

  // --- flatten ---

  const taktNameById = new Map<string, string>((plot.takts ?? []).map((t) => [t.id, t.name]));

  // getNirReports returns newest first; the chart and the history table both
  // read oldest first.
  const history = (nirReports as ApiNirReport[]).map((r) => toNirRow(r, taktNameById)).reverse();
  const latestReport = (nirReports as ApiNirReport[])[0] ?? null;
  const latest = history.length > 0 ? history[history.length - 1] : null;

  const weather = computeUpcomingWeather(
    (weatherRows || []).map(toWeatherDayLike),
    now,
    toWeatherThresholds(weatherRow)
  );

  const status = computePlotStatus(
    toPlotLike(plot),
    toNirLike(latestReport),
    rules as ParameterRule[],
    weather,
    (windowRows || []).map(toVarietyWindowLike),
    now
  );

  // --- plot identity ---

  const details = plot.details ?? null;
  const plantYear = details?.plant_year_label ?? plot.planting_time?.slice(0, 4) ?? null;
  const sizeDunam = numeric(plot.size);
  const harvesterLabel = details?.harvester
    ? (HARVESTER_LABELS[details.harvester as HarvesterType] ?? details.harvester)
    : null;

  // --- tags ---

  const kgPerDunam = numeric(
    (yieldEstimates as Record<string, { kg_per_dunam?: unknown }>)[areaId]?.kg_per_dunam
  );
  const load = yieldLoadInfo(kgPerDunam);

  const tags: ReportTag[] = [];
  if (details?.plot_type) {
    tags.push({
      label: 'סוג מגדל',
      value: PLOT_TYPE_LABELS[details.plot_type as PlotType] ?? details.plot_type,
    });
  }
  if (harvesterLabel) tags.push({ label: 'מוסקת', value: harvesterLabel });
  if (details?.water_type) {
    tags.push({
      label: 'מים',
      value: WATER_TYPE_LABELS[details.water_type as WaterType] ?? details.water_type,
    });
  }
  if (latest?.irrigAmount !== null && latest?.irrigAmount !== undefined) {
    tags.push({
      label: `השקיה (${latest.reportDate ?? ''})`.trim(),
      value: `${fmt(latest.irrigAmount)} קוב/דונם`,
    });
  }
  if (kgPerDunam !== null) {
    const total = sizeDunam !== null ? ` · ${fmt(kgPerDunam * sizeDunam, 0)} ק"ג` : '';
    tags.push({
      label: season ? `הערכת יבול ${season.name}` : 'הערכת יבול',
      value: `${fmt(kgPerDunam, 0)} ק"ג/דונם${total}${load ? ` · ${load.label}` : ''}`,
    });
  }
  const taktCount = plot.takts?.length ?? numeric(details?.takt_count) ?? 0;
  if (taktCount > 0) tags.push({ label: 'טאקטים', value: String(taktCount) });

  // --- KPIs ---
  //
  // Four tiles, where the prototype had three. Acidity is measured on every
  // reading and rises with oil, and leaving it off a ripeness report sent to a
  // grower loses a number they act on. It has no rules row (only oil, water and
  // dry are banded in 20260908100000), so evaluateParameter returns null and the
  // tile renders unflagged — correct, not a gap.

  const kpis: ReportKpi[] = [
    {
      label: 'שמן',
      value: fmt(latest?.oil ?? null),
      unit: '%',
      flagClass: flagClass(
        evaluateParameter(rules as ParameterRule[], 'oil', latest?.oil ?? null)?.status
      ),
    },
    {
      label: 'מים',
      value: fmt(latest?.water ?? null),
      unit: '%',
      flagClass: flagClass(
        evaluateParameter(rules as ParameterRule[], 'water', latest?.water ?? null)?.status
      ),
    },
    {
      label: 'שמן בחו"י',
      value: fmt(latest?.dry ?? null, 2),
      unit: '%',
      flagClass: flagClass(
        evaluateParameter(rules as ParameterRule[], 'dry', latest?.dry ?? null)?.status
      ),
    },
    {
      label: 'חומציות',
      value: fmt(latest?.acid ?? null, 2),
      unit: '%',
      flagClass: flagClass(
        evaluateParameter(rules as ParameterRule[], 'acid', latest?.acid ?? null)?.status
      ),
    },
  ];

  const subValues: ReportTag[] = [];
  if (latest) {
    if (latest.green !== null) subValues.push({ label: 'ירוק', value: `${fmt(latest.green)}%` });
    if (latest.maturity !== null)
      subValues.push({ label: 'הבשלה', value: fmt(latest.maturity, 2) });
    if (latest.subAreaName) subValues.push({ label: 'טאקט', value: latest.subAreaName });
    if (latest.direction) subValues.push({ label: 'כיוון', value: latest.direction });
    // Imported readings carry no worker: lib/olive/import-backup.ts writes the
    // header without one, and the prototype's `examiner` field is not mapped.
    subValues.push({ label: 'נבדק ע"י', value: latest.workerName || '—' });
  }

  // --- harvest actuals ---

  const harvestRows = (harvestReports || []).map((r) => toHarvestRow(r, taktNameById));
  const harvest: HarvestTotals | null =
    harvestRows.length > 0
      ? (() => {
          const sum = (pick: (r: (typeof harvestRows)[number]) => number | null) =>
            harvestRows.reduce<number | null>((acc, r) => {
              const v = pick(r);
              return v === null ? acc : (acc ?? 0) + v;
            }, null);

          const fruitKg = sum((r) => r.fruitKg);
          const oilKg = sum((r) => r.oilKg);
          const areaDoneDunam = sum((r) => r.areaDoneDunam);
          const basis = areaDoneDunam ?? sizeDunam;

          return {
            passes: harvestRows.length,
            fruitKg,
            oilKg,
            areaDoneDunam,
            fruitPerDunam: fruitKg !== null && basis ? fruitKg / basis : null,
            oilPerDunam: oilKg !== null && basis ? oilKg / basis : null,
            oilPercent: fruitKg && oilKg !== null ? (oilKg / fruitKg) * 100 : null,
          };
        })()
      : null;

  return {
    generatedAt: `${now.toLocaleDateString('he-IL')}, ${now.toLocaleTimeString('he-IL', {
      hour: '2-digit',
      minute: '2-digit',
    })}`,
    seasonLabel: season
      ? `${season.name}${season.year_type ? ` (${season.year_type})` : ''}`
      : null,

    plotName: plot.name ?? '',
    growerName: details?.grower_name ?? '—',
    variety: plot.variety,
    region: details?.region ?? null,
    plantYear,
    maturityLabel: maturityLabel(plantYear, now),
    sizeDunam,

    tags,
    status: { level: status.level, headline: status.headline, windowLine: status.windowLine },
    recommendation: buildRecommendation({
      headline: status.headline,
      windowLine: status.windowLine,
      weatherLines: weather.weatherLines,
      harvesterLabel,
    }),
    weatherLines: weather.weatherLines,

    latest,
    latestDateLabel: latest?.reportDate
      ? `${latest.reportDate}${daysSinceLabel(latest.reportDate, now) ? ` (${daysSinceLabel(latest.reportDate, now)})` : ''}`
      : null,
    kpis,
    subValues,

    history,
    harvest,
  };
}
