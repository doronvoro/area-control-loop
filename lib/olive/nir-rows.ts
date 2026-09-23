/**
 * The NIR log's row model, and the pure filter/sort over it.
 *
 * This exists as a module rather than a `useMemo` in the page for one reason:
 * Postgres NUMERIC arrives over PostgREST as a STRING. Sorting `detail.oil`
 * directly would be a lexical sort, where "9" > "17" — the same trap
 * evaluateParameter() documents for upper_bound, and one that every
 * fixture-based test would sail past. Coerce once, at this boundary, and let
 * the table read numbers.
 *
 * Everything here is pure; `now` is injected, matching lib/olive/logic.ts.
 */

import {
  PARAMETER_STATUS_CONFIG,
  type ParameterRule,
  type ParameterStatus,
} from '@/types/database';
import { evaluateParameter, toDateString } from './logic';
import type { ApiNirReport } from './adapt';
import type { SortState } from '@/components/ui/sortable-table-head';

/** A NIR reading flattened for display, with every numeric already coerced. */
export interface NirRow {
  /** report_areas.id — the key PUT and DELETE take. */
  id: string;
  reportNumber: number | null;
  /** Calendar day only; report_date is timestamptz. */
  reportDate: string | null;
  createdAt: string;
  areaId: string | null;
  areaName: string;
  variety: string | null;
  workerName: string;
  subAreaId: string | null;
  subAreaName: string | null;
  direction: string | null;
  oil: number | null;
  water: number | null;
  dry: number | null;
  green: number | null;
  acid: number | null;
  maturity: number | null;
  irrigAmount: number | null;
  /**
   * The LOCAL calendar day the reading was sent to the client, or null.
   *
   * sent_to_client_at is stored as an instant, so this is not a slice: a 01:30
   * local send is …T22:30:00Z the day before, and slicing would display
   * yesterday. The instant itself stays reachable through `raw`.
   */
  sentToClientAt: string | null;
  /** Resolved display name of whoever sent it. Null when unsent or unresolvable. */
  sentToClientBy: string | null;
  notes: string;
  /** The row the drawer resets the form from. */
  raw: ApiNirReport;
}

export type NirSortField =
  | 'reportDate'
  | 'reportNumber'
  | 'areaName'
  | 'oil'
  | 'water'
  | 'dry'
  | 'green'
  | 'acid'
  | 'maturity'
  | 'irrigAmount'
  | 'sent'
  | 'status';

export interface NirFilters {
  search: string;
  /** '' or 'all' both mean no filter — SearchableSelect's clear button emits ''. */
  areaId: string;
  /** 'all' | ParameterStatus | 'none' (no oil reading to score). */
  status: string;
  direction: string;
  /** 'all' | 'sent' | 'unsent'. */
  sent: string;
}

export const EMPTY_NIR_FILTERS: NirFilters = {
  search: '',
  areaId: '',
  status: 'all',
  direction: 'all',
  sent: 'all',
};

/**
 * How many filters are set, for the panel's "מסונן (n)" badge.
 * hasActiveNirFilters is derived from it so the badge and the clear button's
 * disabled state cannot disagree.
 */
export function countActiveNirFilters(f: NirFilters): number {
  let n = 0;
  if (f.search.trim() !== '') n += 1;
  if (f.areaId !== '' && f.areaId !== 'all') n += 1;
  if (f.status !== 'all') n += 1;
  if (f.direction !== 'all') n += 1;
  if (f.sent !== 'all') n += 1;
  return n;
}

export function hasActiveNirFilters(f: NirFilters): boolean {
  return countActiveNirFilters(f) > 0;
}

/** Flatten one API report. `taktNameById` resolves sub_area_id to a name. */
export function toNirRow(report: ApiNirReport, taktNameById: Map<string, string>): NirRow {
  const detail = (report.detail ?? {}) as Record<string, unknown>;
  const area = report.area as { id?: string; name?: string; variety?: string | null } | null;
  const worker = report.worker as { name?: string } | null;
  const subAreaId = (detail.sub_area_id as string | null) ?? null;

  return {
    id: report.id,
    reportNumber: numeric(report.report_number),
    reportDate: report.report_date ? String(report.report_date).slice(0, 10) : null,
    createdAt: report.created_at,
    areaId: area?.id ?? null,
    areaName: area?.name ?? '',
    variety: area?.variety ?? null,
    workerName: worker?.name ?? '',
    subAreaId,
    subAreaName: subAreaId ? (taktNameById.get(subAreaId) ?? null) : null,
    direction: (detail.direction as string | null) ?? null,
    oil: numeric(detail.oil),
    water: numeric(detail.water),
    dry: numeric(detail.dry),
    green: numeric(detail.green),
    acid: numeric(detail.acid),
    maturity: numeric(detail.maturity),
    irrigAmount: numeric(detail.irrig_amount),
    sentToClientAt: detail.sent_to_client_at
      ? toDateString(new Date(String(detail.sent_to_client_at)))
      : null,
    sentToClientBy: (report.sent_by_name as string | null) ?? null,
    notes: (report.description as string | null) ?? '',
    raw: report,
  };
}

/**
 * The oil verdict a row is filtered and sorted by.
 *
 * Deliberately NOT report_areas.status: every NIR write patches the header to
 * 'completed', so that column is a constant and would make a useless filter.
 */
export function rowStatus(row: NirRow, rules: ParameterRule[]): ParameterStatus | null {
  return evaluateParameter(rules, 'oil', row.oil)?.status ?? null;
}

export function filterNirRows(
  rows: NirRow[],
  filters: NirFilters,
  rules: ParameterRule[]
): NirRow[] {
  const term = filters.search.trim().toLowerCase();
  const areaId = filters.areaId === 'all' ? '' : filters.areaId;

  return rows.filter((row) => {
    if (areaId && row.areaId !== areaId) return false;
    if (filters.direction !== 'all' && row.direction !== filters.direction) return false;

    if (filters.sent !== 'all' && (row.sentToClientAt !== null) !== (filters.sent === 'sent'))
      return false;

    if (filters.status !== 'all') {
      const status = rowStatus(row, rules);
      if (filters.status === 'none' ? status !== null : status !== filters.status) return false;
    }

    if (term) {
      const haystack = [
        row.areaName,
        row.variety,
        row.workerName,
        row.notes,
        row.subAreaName,
        row.direction,
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

export function sortNirRows(
  rows: NirRow[],
  sort: SortState<NirSortField>,
  rules: ParameterRule[]
): NirRow[] {
  const factor = sort.direction === 'asc' ? 1 : -1;

  return [...rows].sort((a, b) => {
    const compared = compare(a, b, sort.field, rules);
    // A null is "no data", not a small value, so it sorts last in BOTH
    // directions rather than flipping to the top on desc.
    if (compared === null) return 0;
    if (compared === 'a-null') return 1;
    if (compared === 'b-null') return -1;
    // created_at desc is the server's tiebreak; keep it for equal keys so the
    // order stays stable when several readings share a date.
    if (compared === 0) return b.createdAt.localeCompare(a.createdAt);
    return compared * factor;
  });
}

// --- Private helpers ---

type Comparison = number | 'a-null' | 'b-null' | null;

function compare(a: NirRow, b: NirRow, field: NirSortField, rules: ParameterRule[]): Comparison {
  if (field === 'areaName') {
    // Hebrew collation — a plain < would order by code point.
    return a.areaName.localeCompare(b.areaName, 'he');
  }

  if (field === 'reportDate') {
    return nullsLast(a.reportDate, b.reportDate, (x, y) => x.localeCompare(y));
  }

  if (field === 'sent') {
    return nullsLast(a.sentToClientAt, b.sentToClientAt, (x, y) => x.localeCompare(y));
  }

  if (field === 'status') {
    const severity = (row: NirRow) => {
      const status = rowStatus(row, rules);
      return status === null ? null : PARAMETER_STATUS_CONFIG[status].severity;
    };
    return nullsLast(severity(a), severity(b), (x, y) => x - y);
  }

  return nullsLast(a[field], b[field], (x, y) => x - y);
}

function nullsLast<T>(a: T | null, b: T | null, cmp: (x: T, y: T) => number): Comparison {
  if (a === null && b === null) return null;
  if (a === null) return 'a-null';
  if (b === null) return 'b-null';
  return cmp(a, b);
}

/** Same coercion as lib/olive/adapt.ts — NUMERIC over PostgREST is a string. */
function numeric(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
