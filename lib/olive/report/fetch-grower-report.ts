/**
 * Everything the grower season report prints, in one batched load.
 *
 * WHY THIS IS NOT fetchPlotReport IN A LOOP
 * That loader runs about nine queries per plot, five of which (parameter rules,
 * variety windows, weather thresholds, weather days, active season) are global
 * and return the same rows every time. Over a twenty-plot grower the loop is
 * ~180 round-trips to fetch the same five answers twenty times. This issues a
 * fixed ~12 regardless of plot count: the config once, then one query per
 * collection across every area id, grouped in memory afterwards.
 *
 * The per-plot report stays as it is — for one plot the loop is the clearer
 * code, and the two loaders share their helpers rather than their shape.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { getOlivePlots } from '@/lib/services/olive-plot.service';
import { getNirReports, NIR_ROW_CAP } from '@/lib/services/olive-nir.service';
import { getHarvestReports } from '@/lib/services/olive-harvest.service';
import { getYieldEstimatesBySeason } from '@/lib/services/olive-yield.service';
import { getWeatherDays } from '@/lib/services/olive-weather.service';
import { getAccessibleAreaIds } from '@/lib/services/customer-area.service';
import {
  getParameterRules,
  getVarietyWindows,
  getWeatherThresholds,
  getCategoryThresholds,
  getActiveSeason,
} from '@/lib/services/olive-config.service';

import {
  toWeatherDayLike,
  toWeatherThresholds,
  toCategoryThresholds,
  toVarietyWindowLike,
  toPlotLike,
  toNirLike,
  type ApiPlot,
  type ApiNirReport,
} from '@/lib/olive/adapt';
import { computeUpcomingWeather, computePlotStatus, classifyPlotCategory } from '@/lib/olive/logic';
import { toPlotRow, type PlotRow } from '@/lib/olive/plot-rows';
import { toHarvestRow } from '@/lib/olive/harvest-rows';
import { PLOT_CATEGORY_CARDS } from '@/lib/olive/constants';
import {
  groupByUrgency,
  atAGlance,
  UNSAMPLED,
  type GroupKey,
  type UrgencyGroup,
} from './urgency-groups';
import { PLOT_TYPE_LABELS, type ParameterRule, type PlotType } from '@/types/database';

// --- Types ---

export interface GrowerPlotEntry {
  level: GroupKey;
  sortKey: string;
  row: PlotRow;
  /** computePlotStatus().headline — '' for an unsampled plot. */
  headline: string;
  /** Not on PlotRow, which predates the report; read off the latest reading. */
  acid: number | null;
}

/**
 * One reason, and the plots it applies to.
 *
 * Plots at the same urgency usually share a headline — ten plots all inside the
 * variety's harvest window produce ten copies of one sentence. Printing the
 * reason once above its plots says the same thing and can be read at a glance,
 * which is what the block is called.
 */
export interface GlanceReason {
  headline: string;
  level: GroupKey;
  names: string[];
}

export interface CategoryCount {
  key: string;
  label: string;
  count: number;
}

export interface GrowerHarvestTotals {
  passes: number;
  fruitKg: number | null;
  oilKg: number | null;
  areaDoneDunam: number | null;
}

export interface GrowerReportData {
  generatedAt: string;
  seasonLabel: string | null;

  growerName: string;
  growerTypeLabel: string | null;
  customerName: string | null;
  contactLines: string[];

  plotCount: number;
  totalDunam: number;

  categories: CategoryCount[];
  weatherLines: string[];

  glance: GlanceReason[];
  groups: UrgencyGroup<GrowerPlotEntry>[];
  harvest: GrowerHarvestTotals | null;

  /**
   * True when the reading query hit its cap, so the history behind these rows is
   * incomplete. Printed rather than swallowed — a silently short report looks
   * exactly like a well-sampled one.
   */
  truncated: boolean;
}

// --- Helpers ---

/** Local YYYY-MM-DD; see the note in app/api/olive/dashboard/route.ts:25. */
function todayString(now: Date): string {
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-');
}

function numeric(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Groups the at-a-glance entries by their shared headline, order preserved. */
function collapseByHeadline(entries: GrowerPlotEntry[]): GlanceReason[] {
  const byHeadline = new Map<string, GlanceReason>();

  for (const entry of entries) {
    const existing = byHeadline.get(entry.headline);
    if (existing) existing.names.push(entry.row.name);
    else
      byHeadline.set(entry.headline, {
        headline: entry.headline,
        level: entry.level,
        names: [entry.row.name],
      });
  }

  return [...byHeadline.values()];
}

// --- Public API ---

/**
 * Null when the grower does not exist or belongs to another tenant — the caller
 * turns that into a 404 rather than a 403, so the page does not confirm that the
 * id exists elsewhere.
 *
 * `customerId` must come from resolveCustomerId(scope). It is passed in rather
 * than resolved here because this module takes a Supabase client, not a request
 * scope, which is what lets the page and the PDF route share it.
 */
export async function fetchGrowerReport(
  supabase: SupabaseClient,
  growerId: string,
  customerId: string,
  now: Date
): Promise<GrowerReportData | null> {
  // Scoped by customer as well as by RLS: `growers` is protected by
  // can_access_customer, which for an admin spans every tenant, so without this
  // an admin viewing customer A could open customer B's grower by id.
  const { data: grower } = await supabase
    .from('growers')
    .select('*')
    .eq('id', growerId)
    .eq('customer_id', customerId)
    .maybeSingle();

  if (!grower) return null;

  const growerRow = grower as Record<string, unknown>;

  const [season, areaIds, customerRow] = await Promise.all([
    getActiveSeason(supabase) as Promise<{
      id: string;
      name: string;
      year_type: string | null;
      starts_on: string;
      ends_on: string;
    } | null>,
    getAccessibleAreaIds(supabase, false, customerId),
    supabase.from('customers').select('name').eq('id', customerId).maybeSingle(),
  ]);

  const allPlots = (await getOlivePlots(supabase, areaIds)) as ApiPlot[];
  const plots = allPlots.filter((p) => p.details?.grower_id === growerId);
  const plotIds = plots.map((p) => p.id);

  const range = season ? { from: season.starts_on, to: season.ends_on } : {};

  const [nirReports, harvestReports, rules, windowRows, weatherRow, categoryRow, weatherRows] =
    await Promise.all([
      getNirReports(supabase, plotIds, { ...range, limit: NIR_ROW_CAP }),
      getHarvestReports(supabase, plotIds, range),
      getParameterRules(supabase),
      getVarietyWindows(supabase),
      getWeatherThresholds(supabase),
      getCategoryThresholds(supabase),
      getWeatherDays(supabase, todayString(now)),
    ]);

  const yieldEstimates = season
    ? await getYieldEstimatesBySeason(supabase, season.id, plotIds)
    : {};

  // --- shared, computed once for the whole report ---

  const weather = computeUpcomingWeather(
    (weatherRows || []).map(toWeatherDayLike),
    now,
    toWeatherThresholds(weatherRow)
  );
  const windows = (windowRows || []).map(toVarietyWindowLike);
  const bands = toCategoryThresholds(categoryRow);
  const parameterRules = rules as ParameterRule[];

  // getNirReports returns every plot's readings interleaved, newest first. One
  // pass bucketing by area id beats a filter per plot.
  const latestByArea = new Map<string, ApiNirReport>();
  for (const report of nirReports as ApiNirReport[]) {
    const areaId = (report.area as { id?: string } | null)?.id;
    if (areaId && !latestByArea.has(areaId)) latestByArea.set(areaId, report);
  }

  // --- per plot ---

  const entries: GrowerPlotEntry[] = plots.map((plot) => {
    const latest = latestByArea.get(plot.id) ?? null;
    const nir = toNirLike(latest);
    const row = toPlotRow({
      plot,
      nir,
      category: classifyPlotCategory(nir, parameterRules, bands),
      harvested: false,
      yieldEstimate:
        (yieldEstimates as Record<string, { kg_per_dunam?: unknown }>)[plot.id] ?? null,
      now,
    });

    // An unsampled plot has no urgency to report — computePlotStatus would hand
    // back the neutral 'ok' headline, which reads as "nothing to worry about"
    // when the truth is that nobody has looked.
    const acid = numeric((latest?.detail as { acid?: unknown } | null | undefined)?.acid);

    if (!nir) {
      return { level: UNSAMPLED, sortKey: row.name, row, headline: '', acid };
    }

    const status = computePlotStatus(toPlotLike(plot), nir, parameterRules, weather, windows, now);
    return { level: status.level, sortKey: row.name, row, headline: status.headline, acid };
  });

  // --- aggregates ---

  const categories: CategoryCount[] = PLOT_CATEGORY_CARDS.map((card) => ({
    key: card.key,
    label: card.label,
    count: entries.filter((e) => e.row.category === card.key).length,
  }));

  const harvestRows = (harvestReports || []).map((r) => toHarvestRow(r, new Map()));
  const sum = (pick: (r: (typeof harvestRows)[number]) => number | null) =>
    harvestRows.reduce<number | null>((acc, r) => {
      const v = pick(r);
      return v === null ? acc : (acc ?? 0) + v;
    }, null);

  const harvest: GrowerHarvestTotals | null =
    harvestRows.length > 0
      ? {
          passes: harvestRows.length,
          fruitKg: sum((r) => r.fruitKg),
          oilKg: sum((r) => r.oilKg),
          areaDoneDunam: sum((r) => r.areaDoneDunam),
        }
      : null;

  const contactLines = [
    growerRow.contact_person,
    growerRow.contact_phone,
    growerRow.contact_mobile,
    growerRow.contact_email,
    [growerRow.address, growerRow.city].filter(Boolean).join(', ') || null,
  ]
    .filter((v): v is string => typeof v === 'string' && v.trim() !== '')
    .map((v) => v.trim());

  const growerType = growerRow.grower_type as string | null;

  return {
    generatedAt: `${now.toLocaleDateString('he-IL')}, ${now.toLocaleTimeString('he-IL', {
      hour: '2-digit',
      minute: '2-digit',
    })}`,
    seasonLabel: season
      ? `${season.name}${season.year_type ? ` (${season.year_type})` : ''}`
      : null,

    growerName: String(growerRow.name ?? '—'),
    growerTypeLabel: growerType ? (PLOT_TYPE_LABELS[growerType as PlotType] ?? growerType) : null,
    customerName: (customerRow.data as { name?: string } | null)?.name ?? null,
    contactLines,

    plotCount: plots.length,
    totalDunam: Math.round(plots.reduce((acc, p) => acc + (numeric(p.size) ?? 0), 0) * 10) / 10,

    categories,
    weatherLines: weather.weatherLines,

    glance: collapseByHeadline(atAGlance(entries)),
    groups: groupByUrgency(entries),
    harvest,

    truncated: (nirReports as unknown[]).length >= NIR_ROW_CAP,
  };
}
