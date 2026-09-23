/**
 * The harvest log's row model, and the pure filter/sort over it.
 *
 * Same boundary, and the same reason, as lib/olive/nir-rows.ts: Postgres
 * NUMERIC arrives over PostgREST as a STRING, so sorting `detail.fruit_kg`
 * directly is lexical, where "9" > "17". The old log printed those strings
 * straight into the cell, which is why a weight could render as "1234.00".
 *
 * Two of the columns here are ratios the table derives rather than stores —
 * kg of fruit per dunam, and oil as a percentage of fruit. They are the two
 * figures the form already computes live while a pass is being entered; the
 * log had no way to show them at all.
 *
 * Everything here is pure.
 */

import { HARVESTER_LABELS, type HarvesterType } from '@/types/database';
import type { SortState } from '@/components/ui/sortable-table-head';

/** A harvest pass flattened for display, with every numeric already coerced. */
export interface HarvestRow {
  /** report_areas.id — the key PUT and DELETE take. */
  id: string;
  reportNumber: number | null;
  /** Calendar day only; report_date is timestamptz. */
  reportDate: string | null;
  createdAt: string;
  areaId: string | null;
  areaName: string;
  variety: string | null;
  /** The plot's full size, for context against areaDoneDunam. */
  plotSize: number | null;
  workerName: string;
  subAreaId: string | null;
  subAreaName: string | null;
  passNumber: number | null;
  harvesterType: string | null;
  /** HARVESTER_LABELS where the value is known, else the raw string. */
  harvesterLabel: string | null;
  operator: string | null;
  areaDoneDunam: number | null;
  fruitKg: number | null;
  oilKg: number | null;
  isFinal: boolean;
  /** fruitKg / areaDoneDunam. Null unless both are present and the area is > 0. */
  kgPerDunam: number | null;
  /** oilKg / fruitKg as a percentage. Null unless both are present and fruit > 0. */
  oilPercent: number | null;
  notes: string;
  raw: Record<string, unknown>;
}

export type HarvestSortField =
  | 'reportDate'
  | 'reportNumber'
  | 'areaName'
  | 'passNumber'
  | 'areaDoneDunam'
  | 'fruitKg'
  | 'oilKg'
  | 'kgPerDunam'
  | 'oilPercent'
  | 'isFinal';

export interface HarvestFilters {
  search: string;
  /** '' or 'all' both mean no filter — SearchableSelect's clear button emits ''. */
  areaId: string;
  /** 'all' | a HarvesterType value | 'none' (no equipment recorded). */
  harvester: string;
  /** 'all' | 'final' | 'partial'. */
  finality: string;
}

export const EMPTY_HARVEST_FILTERS: HarvestFilters = {
  search: '',
  areaId: '',
  harvester: 'all',
  finality: 'all',
};

/**
 * How many filters are set, for the panel's "מסונן (n)" badge.
 * hasActiveHarvestFilters is derived from it so the badge and the clear
 * button's disabled state cannot disagree.
 */
export function countActiveHarvestFilters(f: HarvestFilters): number {
  let n = 0;
  if (f.search.trim() !== '') n += 1;
  if (f.areaId !== '' && f.areaId !== 'all') n += 1;
  if (f.harvester !== 'all') n += 1;
  if (f.finality !== 'all') n += 1;
  return n;
}

export function hasActiveHarvestFilters(f: HarvestFilters): boolean {
  return countActiveHarvestFilters(f) > 0;
}

/** Flatten one API report. `taktNameById` resolves sub_area_id to a name. */
export function toHarvestRow(
  report: Record<string, unknown>,
  taktNameById: Map<string, string>
): HarvestRow {
  const detail = (report.detail ?? {}) as Record<string, unknown>;
  const area = report.area as {
    id?: string;
    name?: string;
    variety?: string | null;
    size?: unknown;
  } | null;
  const worker = report.worker as { name?: string } | null;
  const subAreaId = (detail.sub_area_id as string | null) ?? null;

  const areaDoneDunam = numeric(detail.area_done_dunam);
  const fruitKg = numeric(detail.fruit_kg);
  const oilKg = numeric(detail.oil_kg);

  // harvester_type is a bare TEXT column with no CHECK, so a value outside the
  // enum is possible; show it rather than an empty cell.
  const harvesterType = (detail.harvester_type as string | null) ?? null;

  return {
    id: report.id as string,
    reportNumber: numeric(report.report_number),
    reportDate: report.report_date ? String(report.report_date).slice(0, 10) : null,
    createdAt: report.created_at as string,
    areaId: area?.id ?? null,
    areaName: area?.name ?? '',
    variety: area?.variety ?? null,
    plotSize: numeric(area?.size),
    workerName: worker?.name ?? '',
    subAreaId,
    subAreaName: subAreaId ? (taktNameById.get(subAreaId) ?? null) : null,
    passNumber: numeric(detail.pass_number),
    harvesterType,
    harvesterLabel: harvesterType
      ? (HARVESTER_LABELS[harvesterType as HarvesterType] ?? harvesterType)
      : null,
    operator: (detail.operator as string | null) ?? null,
    areaDoneDunam,
    fruitKg,
    oilKg,
    isFinal: Boolean(detail.is_final),
    kgPerDunam:
      fruitKg !== null && areaDoneDunam !== null && areaDoneDunam > 0
        ? fruitKg / areaDoneDunam
        : null,
    oilPercent: oilKg !== null && fruitKg !== null && fruitKg > 0 ? (oilKg / fruitKg) * 100 : null,
    notes: (report.description as string | null) ?? '',
    raw: report,
  };
}

export function filterHarvestRows(rows: HarvestRow[], filters: HarvestFilters): HarvestRow[] {
  const term = filters.search.trim().toLowerCase();
  const areaId = filters.areaId === 'all' ? '' : filters.areaId;

  return rows.filter((row) => {
    if (areaId && row.areaId !== areaId) return false;

    if (filters.harvester !== 'all') {
      if (
        filters.harvester === 'none'
          ? row.harvesterType !== null
          : row.harvesterType !== filters.harvester
      )
        return false;
    }

    if (filters.finality !== 'all' && row.isFinal !== (filters.finality === 'final')) return false;

    if (term) {
      const haystack = [
        row.areaName,
        row.variety,
        row.workerName,
        row.operator,
        row.notes,
        row.subAreaName,
        row.harvesterLabel,
        row.reportNumber !== null ? String(row.reportNumber) : '',
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(term)) return false;
    }

    return true;
  });
}

export function sortHarvestRows(
  rows: HarvestRow[],
  sort: SortState<HarvestSortField>
): HarvestRow[] {
  const factor = sort.direction === 'asc' ? 1 : -1;

  return [...rows].sort((a, b) => {
    const compared = compare(a, b, sort.field);
    // A null is "no data", not a small value, so it sorts last in BOTH
    // directions rather than flipping to the top on desc.
    if (compared === null) return 0;
    if (compared === 'a-null') return 1;
    if (compared === 'b-null') return -1;
    // created_at desc is the server's tiebreak; keep it so the order stays
    // stable when several passes share a date.
    if (compared === 0) return b.createdAt.localeCompare(a.createdAt);
    return compared * factor;
  });
}

// --- Private helpers ---

type Comparison = number | 'a-null' | 'b-null' | null;

function compare(a: HarvestRow, b: HarvestRow, field: HarvestSortField): Comparison {
  if (field === 'areaName') {
    // Hebrew collation — a plain < would order by code point.
    return a.areaName.localeCompare(b.areaName, 'he');
  }

  if (field === 'reportDate') {
    return nullsLast(a.reportDate, b.reportDate, (x, y) => x.localeCompare(y));
  }

  if (field === 'isFinal') {
    return Number(a.isFinal) - Number(b.isFinal);
  }

  return nullsLast(a[field], b[field], (x, y) => x - y);
}

function nullsLast<T>(a: T | null, b: T | null, cmp: (x: T, y: T) => number): Comparison {
  if (a === null && b === null) return null;
  if (a === null) return 'a-null';
  if (b === null) return 'b-null';
  return cmp(a, b);
}

/** Same coercion as lib/olive/nir-rows.ts — NUMERIC over PostgREST is a string. */
function numeric(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
