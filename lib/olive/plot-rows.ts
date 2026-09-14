/**
 * The plot list's row model, and the pure filter/sort over it.
 *
 * Same boundary as lib/olive/nir-rows.ts and harvest-rows.ts. The plot's own
 * numbers (size) and its latest NIR measurements all arrive from PostgREST as
 * NUMERIC strings, so they are coerced once here and the table reads numbers.
 *
 * The screen used to show only a name, a region and a category word; the
 * measurements behind the category were computed for every row and then
 * dropped. They are on the row now, which is also what makes them sortable.
 */

import { PLOT_CATEGORY_CARDS } from './constants';
import { daysSinceLabel, plotMatchesSearch, yieldLoadInfo, type PlotCategory } from './logic';
import type { ApiPlot } from './adapt';
import type { SortState } from '@/components/ui/sortable-table-head';
import { ParameterStatus } from '@/types/database';

/** A plot flattened for display, with every numeric already coerced. */
export interface PlotRow {
  id: string;
  name: string;
  variety: string | null;
  growerName: string | null;
  /** PlotType value ('owner' | 'partner' | 'occasional'), or null. */
  plotType: string | null;
  region: string | null;
  waterType: string | null;
  harvester: string | null;
  plantYear: string | null;
  size: number | null;
  taktCount: number;
  category: PlotCategory;
  harvested: boolean;
  /** Days since the last NIR reading; null when never measured. */
  daysSinceNir: number | null;
  /** "היום" / "לפני N ימים", or null when never measured. */
  lastMeasuredLabel: string | null;
  oil: number | null;
  water: number | null;
  dry: number | null;
  yieldKgPerDunam: number | null;
  yieldLoad: { label: string; status: ParameterStatus } | null;
  /** The row the edit dialog takes. */
  plot: ApiPlot;
}

export type PlotSortField =
  | 'name'
  | 'growerName'
  | 'region'
  | 'size'
  | 'taktCount'
  | 'category'
  | 'daysSinceNir'
  | 'oil'
  | 'water'
  | 'yieldKgPerDunam';

export interface PlotFilters {
  search: string;
  /** 'all' | a PlotType value. */
  plotType: string;
  /** 'all' | a PlotCategory value. */
  category: string;
  /** 'all' | 'harvested' | 'active'. */
  harvest: string;
  /** 'all' | 'measured' | 'never'. */
  nir: string;
}

export const EMPTY_PLOT_FILTERS: PlotFilters = {
  search: '',
  plotType: 'all',
  category: 'all',
  harvest: 'all',
  nir: 'all',
};

export function hasActivePlotFilters(f: PlotFilters): boolean {
  return (
    f.search.trim() !== '' ||
    f.plotType !== 'all' ||
    f.category !== 'all' ||
    f.harvest !== 'all' ||
    f.nir !== 'all'
  );
}

/** Display order for the category column, shared with the dashboard's cards. */
const CATEGORY_ORDER = new Map(PLOT_CATEGORY_CARDS.map((card, i) => [card.key, i]));

export function categoryLabel(category: PlotCategory): string {
  return PLOT_CATEGORY_CARDS.find((c) => c.key === category)?.label ?? category;
}

interface ToPlotRowInput {
  plot: ApiPlot;
  /** Flattened latest NIR for this plot, as toNirLike returns it. */
  nir: {
    report_date: string | null;
    oil: number | null;
    water: number | null;
    dry: number | null;
  } | null;
  category: PlotCategory;
  harvested: boolean;
  /** The yield estimate row for this plot, if the season has one. */
  yieldEstimate: { kg_per_dunam?: unknown } | null;
  now: Date;
}

export function toPlotRow({
  plot,
  nir,
  category,
  harvested,
  yieldEstimate,
  now,
}: ToPlotRowInput): PlotRow {
  const details = plot.details ?? null;
  const kgPerDunam = numeric(yieldEstimate?.kg_per_dunam);

  return {
    id: plot.id,
    name: plot.name ?? '',
    variety: plot.variety,
    growerName: details?.grower_name ?? null,
    plotType: details?.plot_type ?? null,
    region: details?.region ?? null,
    waterType: details?.water_type ?? null,
    harvester: details?.harvester ?? null,
    plantYear: details?.plant_year_label ?? plot.planting_time ?? null,
    size: numeric(plot.size),
    taktCount: plot.takts?.length ?? numeric(details?.takt_count) ?? 0,
    category,
    harvested,
    daysSinceNir: daysSince(nir?.report_date ?? null, now),
    lastMeasuredLabel: daysSinceLabel(nir?.report_date ?? null, now),
    oil: numeric(nir?.oil),
    water: numeric(nir?.water),
    dry: numeric(nir?.dry),
    yieldKgPerDunam: kgPerDunam,
    yieldLoad: yieldLoadInfo(kgPerDunam),
    plot,
  };
}

export function filterPlotRows(rows: PlotRow[], filters: PlotFilters): PlotRow[] {
  const term = filters.search.trim();

  return rows.filter((row) => {
    if (filters.plotType !== 'all' && row.plotType !== filters.plotType) return false;
    if (filters.category !== 'all' && row.category !== filters.category) return false;

    if (filters.harvest !== 'all' && row.harvested !== (filters.harvest === 'harvested'))
      return false;

    if (filters.nir !== 'all') {
      const measured = row.daysSinceNir !== null;
      if (measured !== (filters.nir === 'measured')) return false;
    }

    if (term) {
      // Reuses the dashboard's matcher, which also matches the Hebrew initials
      // of a plot name so "מא" reaches "מיצר — 2003 — ארבקינה".
      const matches = plotMatchesSearch(
        {
          id: row.id,
          name: row.name,
          variety: row.variety,
          region: row.region,
          grower_name: row.growerName,
        },
        term
      );
      if (!matches) return false;
    }

    return true;
  });
}

export function sortPlotRows(rows: PlotRow[], sort: SortState<PlotSortField>): PlotRow[] {
  const factor = sort.direction === 'asc' ? 1 : -1;

  return [...rows].sort((a, b) => {
    const compared = compare(a, b, sort.field);
    // A null is "no data", not a small value, so it sorts last in BOTH
    // directions rather than flipping to the top on desc.
    if (compared === null) return 0;
    if (compared === 'a-null') return 1;
    if (compared === 'b-null') return -1;
    // Plot name is the stable tiebreak — it is what the server orders by.
    if (compared === 0) return a.name.localeCompare(b.name, 'he');
    return compared * factor;
  });
}

// --- Private helpers ---

type Comparison = number | 'a-null' | 'b-null' | null;

function compare(a: PlotRow, b: PlotRow, field: PlotSortField): Comparison {
  if (field === 'name') {
    return a.name.localeCompare(b.name, 'he');
  }

  if (field === 'growerName' || field === 'region') {
    // Hebrew collation, and a plot with no grower or region sorts last.
    return nullsLast(a[field], b[field], (x, y) => x.localeCompare(y, 'he'));
  }

  if (field === 'category') {
    return (CATEGORY_ORDER.get(a.category) ?? 99) - (CATEGORY_ORDER.get(b.category) ?? 99);
  }

  return nullsLast(a[field], b[field], (x, y) => x - y);
}

function nullsLast<T>(a: T | null, b: T | null, cmp: (x: T, y: T) => number): Comparison {
  if (a === null && b === null) return null;
  if (a === null) return 'a-null';
  if (b === null) return 'b-null';
  return cmp(a, b);
}

/**
 * Whole days since a measurement. Mirrors daysSinceLabel's parsing so the
 * sortable number and the label a reader sees cannot disagree.
 */
function daysSince(dateStr: string | null, now: Date): number | null {
  if (!dateStr) return null;
  const then = new Date(`${dateStr.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(then.getTime())) return null;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.floor((startOfToday.getTime() - then.getTime()) / (1000 * 60 * 60 * 24));
  return days < 0 ? null : days;
}

/** Same coercion as the other olive row models — NUMERIC over PostgREST is a string. */
function numeric(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
