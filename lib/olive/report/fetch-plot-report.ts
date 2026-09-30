/**
 * Everything the per-plot status report prints, in one call.
 *
 * Originally ported from the client prototype's generatePlotReport /
 * buildReportHTML (docs/code.html:6042 and :5926); the fields now follow the
 * client's sample report of 2026-09-29, which trims that layout. Where the
 * sample itself falls short, see docs/OLIVE_PLOT_REPORT_SAMPLE_ISSUES.md.
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
import { getNirReports, isFruitReading } from '@/lib/services/olive-nir.service';
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
  type UrgencyLevel,
} from '@/lib/olive/logic';
import { toNirRow, type NirRow } from '@/lib/olive/nir-rows';
import { buildParameterRecommendations } from '@/lib/olive/report/recommendation';
import {
  ParameterStatus,
  PLOT_TYPE_LABELS,
  type ParameterRule,
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

/**
 * Rows in the history table. The client's sample titles it "אחרונות" and the
 * prototype sliced to the same five; the chart still gets the full season.
 */
export const HISTORY_TABLE_ROWS = 5;

export interface PlotReportData {
  /** he-IL date + time, formatted once here so both renderers agree. */
  generatedAt: string;

  plotName: string;
  growerName: string;
  variety: string | null;
  region: string | null;
  plantYear: string | null;
  maturityLabel: string;
  sizeDunam: number | null;

  /** Who took the latest reading; null for imported readings, which carry none. */
  inspectorName: string | null;

  tags: ReportTag[];

  status: { level: UrgencyLevel; headline: string; windowLine: string };
  /** One line per banded measurement that calls for action; may be empty. */
  recommendations: string[];
  weatherLines: string[];

  latest: NirRow | null;
  latestDateLabel: string | null;
  /** The three banded readings — the large tiles. */
  primaryKpis: ReportKpi[];
  /** Acidity and green — the smaller row under them. */
  secondaryKpis: ReportKpi[];

  /** Oldest first — the order the chart wants. The table reverses and caps it. */
  history: NirRow[];
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
    starts_on: string;
    ends_on: string;
  } | null;

  // The season bounds the report: "the current cycle" is what the customer is
  // being told about. With no active season we fall back to the whole archive
  // rather than showing nothing.
  const range = season ? { from: season.starts_on, to: season.ends_on } : {};

  const [nirReports, rules, windowRows, weatherRow, weatherRows] = await Promise.all([
    getNirReports(supabase, [areaId], range),
    getParameterRules(supabase),
    getVarietyWindows(supabase),
    getWeatherThresholds(supabase),
    getWeatherDays(supabase, todayString(now)),
  ]);

  // --- flatten ---

  const taktNameById = new Map<string, string>((plot.takts ?? []).map((t) => [t.id, t.name]));

  // Fruit only: this report is about ripeness, and pomace oil is extraction
  // loss on a different scale — it would put a spike in the trend and could
  // become the "latest" verdict. See isFruitReading.
  const fruitReports = (nirReports as ApiNirReport[]).filter(isFruitReading);

  // getNirReports returns newest first; the chart reads oldest first.
  const history = fruitReports.map((r) => toNirRow(r, taktNameById)).reverse();
  const latestReport = fruitReports[0] ?? null;
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

  // --- tags ---
  //
  // Grower type only, as in the client's sample. Harvester, water, irrigation,
  // yield estimate and takt count used to follow; the sample drops them and the
  // dashboard still shows every one.

  const tags: ReportTag[] = [];
  if (details?.plot_type) {
    tags.push({
      label: 'סוג מגדל',
      value: PLOT_TYPE_LABELS[details.plot_type as PlotType] ?? details.plot_type,
    });
  }

  // --- KPIs ---
  //
  // Three banded readings as large tiles, then acidity and green as a smaller
  // row, per the sample. Neither of the small two has a rules row (only oil,
  // water and dry are banded in 20260908100000), so evaluateParameter returns
  // null and they render unflagged — correct, not a gap.

  const kpi = (
    label: string,
    code: string,
    value: number | null | undefined,
    digits = 1
  ): ReportKpi => ({
    label,
    value: fmt(value ?? null, digits),
    unit: '%',
    flagClass: flagClass(evaluateParameter(rules as ParameterRule[], code, value ?? null)?.status),
  });

  const primaryKpis: ReportKpi[] = [
    kpi('שמן', 'oil', latest?.oil),
    kpi('מים', 'water', latest?.water),
    kpi('שמן בחו"י', 'dry', latest?.dry, 2),
  ];
  const secondaryKpis: ReportKpi[] = [
    kpi('חומציות בפרי', 'acid', latest?.acid, 2),
    kpi('אחוז צבע ירוק', 'green', latest?.green),
  ];

  return {
    generatedAt: `${now.toLocaleDateString('he-IL')}, ${now.toLocaleTimeString('he-IL', {
      hour: '2-digit',
      minute: '2-digit',
    })}`,

    plotName: plot.name ?? '',
    growerName: details?.grower_name ?? '—',
    variety: plot.variety,
    region: details?.region ?? null,
    plantYear,
    maturityLabel: maturityLabel(plantYear, now),
    sizeDunam: numeric(plot.size),
    // Imported readings carry no worker: lib/olive/import-backup.ts writes the
    // header without one, and the prototype's `examiner` field is not mapped.
    inspectorName: latest?.workerName || null,

    tags,
    status: { level: status.level, headline: status.headline, windowLine: status.windowLine },
    recommendations: buildParameterRecommendations(rules as ParameterRule[], latest),
    weatherLines: weather.weatherLines,

    latest,
    latestDateLabel: latest?.reportDate
      ? `${latest.reportDate}${daysSinceLabel(latest.reportDate, now) ? ` (${daysSinceLabel(latest.reportDate, now)})` : ''}`
      : null,
    primaryKpis,
    secondaryKpis,

    history,
  };
}
