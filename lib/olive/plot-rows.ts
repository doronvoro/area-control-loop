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
import {
  daysSinceLabel,
  plotMatchesSearch,
  toDateString,
  yieldLoadInfo,
  type PlotCategory,
} from './logic';
import { NONE } from '@/lib/forms/none-sentinel';
import type { ApiPlot } from './adapt';
import type { SortState } from '@/components/ui/sortable-table-head';
import { ParameterStatus } from '@/types/database';

/** A plot flattened for display, with every numeric already coerced. */
export interface PlotRow {
  id: string;
  name: string;
  variety: string | null;
  /** growers.id, which is what the grower filter matches on. */
  growerId: string | null;
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
  /**
   * Local day the latest reading was sent to the client, or null if it has not
   * been. Colours the שמן / מים cell, which is the only place on this screen
   * that says anything about the reading itself.
   */
  nirSentToClientAt: string | null;
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
  /** 'all' | a PlotType value. Driven by the header chips, not a dropdown. */
  plotType: string;
  /**
   * '' or 'all' both mean no filter — SearchableSelect's clear button emits ''.
   * NONE means "this plot has no grower", the same word the plot forms use.
   */
  growerId: string;
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
  growerId: '',
  category: 'all',
  harvest: 'all',
  nir: 'all',
};

/**
 * How many filters are set.
 *
 * The panel's "מסונן (n)" badge needs the number, and hasActivePlotFilters is
 * derived from it so the two cannot disagree — the failure mode being a badge
 * that says (2) beside a disabled "נקה סינון".
 */
export function countActivePlotFilters(f: PlotFilters): number {
  let n = 0;
  if (f.search.trim() !== '') n += 1;
  if (f.plotType !== 'all') n += 1;
  // Both spellings of "no grower filter" have to be checked here; collapsing
  // this to a truthiness test would count 'all' as an active filter.
  if (f.growerId !== '' && f.growerId !== 'all') n += 1;
  if (f.category !== 'all') n += 1;
  if (f.harvest !== 'all') n += 1;
  if (f.nir !== 'all') n += 1;
  return n;
}

export function hasActivePlotFilters(f: PlotFilters): boolean {
  return countActivePlotFilters(f) > 0;
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
  /**
   * The latest reading's send stamp, as a raw instant.
   *
   * Passed separately rather than folded into `nir` above: that object is
   * NirLike, which exists for the harvest rules, and when a reading reached the
   * client has no bearing on whether the fruit is ripe.
   */
  nirSentToClientAt?: string | null;
  category: PlotCategory;
  harvested: boolean;
  /** The yield estimate row for this plot, if the season has one. */
  yieldEstimate: { kg_per_dunam?: unknown } | null;
  now: Date;
}

export function toPlotRow({
  plot,
  nir,
  nirSentToClientAt,
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
    growerId: details?.grower_id ?? null,
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
    // Local day, not a slice: the stamp is an instant, and a late-evening send
    // is the previous day in UTC. See lib/olive/logic.ts toDateString.
    nirSentToClientAt: nirSentToClientAt ? toDateString(new Date(String(nirSentToClientAt))) : null,
    oil: numeric(nir?.oil),
    water: numeric(nir?.water),
    dry: numeric(nir?.dry),
    yieldKgPerDunam: kgPerDunam,
    yieldLoad: yieldLoadInfo(kgPerDunam),
    plot,
  };
}

/**
 * The sort cycle behind the merged שמן/מים header.
 *
 * One header over two fields, so a click has to mean more than "flip": it steps
 * oil → water at the direction already chosen, and flips only on the way back
 * round. Four clicks visit all four states and return to the start. A plain
 * two-state oil↔water cycle was the obvious shape and the wrong one — it
 * quietly removes the ability to sort oil ascending, which the separate שמן %
 * header could do.
 *
 * Arriving from any other column starts at oil descending, the same default
 * useTableSort falls back to for a field absent from its directions map.
 */
export function nextOilWaterSort(sort: SortState<PlotSortField>): SortState<PlotSortField> {
  if (sort.field === 'oil') return { field: 'water', direction: sort.direction };
  if (sort.field === 'water') {
    return { field: 'oil', direction: sort.direction === 'asc' ? 'desc' : 'asc' };
  }
  return { field: 'oil', direction: 'desc' };
}

export function filterPlotRows(rows: PlotRow[], filters: PlotFilters): PlotRow[] {
  const term = filters.search.trim();
  // 'all' is tolerated as well as '', so a caller that hands the dropdown
  // vocabulary to the searchable one is not silently filtering everything out.
  const growerId = filters.growerId === 'all' ? '' : filters.growerId;

  return rows.filter((row) => {
    if (filters.plotType !== 'all' && row.plotType !== filters.plotType) return false;

    if (growerId) {
      if (growerId === NONE ? row.growerId !== null : row.growerId !== growerId) return false;
    }

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

/**
 * What each grower-type chip shows.
 *
 * Counted over rows filtered by everything EXCEPT plotType, not over the raw
 * list: a chip promising 29 next to a footer reading "מציג 4" is a lie, and the
 * lie is worst exactly when the numbers matter. With nothing else set,
 * counts.all equals the footer's total.
 *
 * A plot with no plot_type lands in `all` and in no chip, so the chips do not
 * sum to `all`. That is honest — there is no chip for "unclassified", and
 * dropping those rows from `all` would make the table show more plots than the
 * הכל chip claims.
 */
export function plotTypeCounts(rows: PlotRow[], filters: PlotFilters): Record<string, number> {
  const base = filterPlotRows(rows, { ...filters, plotType: 'all' });
  const counts: Record<string, number> = { all: base.length };

  for (const row of base) {
    if (row.plotType) counts[row.plotType] = (counts[row.plotType] ?? 0) + 1;
  }

  return counts;
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
