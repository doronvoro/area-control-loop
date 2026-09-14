import { describe, it, expect } from 'vitest';
import {
  toNirRow,
  filterNirRows,
  sortNirRows,
  hasActiveNirFilters,
  EMPTY_NIR_FILTERS,
  type NirRow,
  type NirSortField,
} from '@/lib/olive/nir-rows';
import type { ApiNirReport } from '@/lib/olive/adapt';
import { ParameterStatus, type ParameterRule } from '@/types/database';

/**
 * The NIR log's row model.
 *
 * The point of most of these tests is the same one lib/olive/logic.ts
 * documents: PostgREST sends NUMERIC as a string, so anything that compares a
 * measurement has to coerce first. A lexical sort puts "9" after "17" and looks
 * entirely plausible on screen.
 */

// ─── fixtures ────────────────────────────────────────────────────────────────

let ruleSeq = 0;
function rule(
  parameter_code: string,
  upper_bound: number | null,
  upper_inclusive: boolean,
  status: ParameterStatus,
  severity: number,
  message: string,
  sort_order: number
): ParameterRule {
  return {
    id: `r${++ruleSeq}`,
    parameter_code,
    upper_bound,
    upper_inclusive,
    status,
    severity,
    message,
    sort_order,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  };
}

/** The oil bands from 20260908100000_create_olive_parameters.sql. */
const RULES: ParameterRule[] = [
  rule('oil', 17, false, ParameterStatus.IDLE, 0, 'לא מוכן למסיק', 1),
  rule('oil', 20, true, ParameterStatus.PLAN, 2, 'מתוכנן למסיק', 2),
  rule('oil', null, false, ParameterStatus.URGENT, 3, 'מסיק מיידי', 3),
];

const TAKTS = new Map([
  ['takt-1', 'טאקט א'],
  ['takt-2', 'טאקט ב'],
]);

function apiReport(overrides: Partial<Record<string, unknown>> = {}): ApiNirReport {
  return {
    id: 'ra-1',
    report_number: 101,
    report_date: '2026-09-12T00:00:00+00:00',
    created_at: '2026-09-12T08:00:00Z',
    description: 'דגימה שגרתית',
    status: 'completed',
    area: { id: 'area-1', name: 'מיצר', variety: 'ארבקינה' },
    worker: { id: 'w-1', name: 'דני' },
    detail: {
      report_area_id: 'ra-1',
      sub_area_id: 'takt-1',
      direction: 'צפון',
      oil: '17.40',
      water: '53.00',
      dry: '37.02',
      green: '12',
      acid: '0.35',
      maturity: '3.2',
      irrig_amount: '1.50',
    },
    ...overrides,
  } as unknown as ApiNirReport;
}

/** A row with only the fields a given test cares about. */
function row(overrides: Partial<NirRow> = {}): NirRow {
  return {
    id: 'ra-x',
    reportNumber: null,
    reportDate: '2026-09-01',
    createdAt: '2026-09-01T00:00:00Z',
    areaId: 'area-1',
    areaName: 'מיצר',
    variety: null,
    workerName: '',
    subAreaId: null,
    subAreaName: null,
    direction: null,
    oil: null,
    water: null,
    dry: null,
    green: null,
    acid: null,
    maturity: null,
    irrigAmount: null,
    notes: '',
    raw: {} as ApiNirReport,
    ...overrides,
  };
}

function sortBy(rows: NirRow[], field: NirSortField, direction: 'asc' | 'desc' = 'asc') {
  return sortNirRows(rows, { field, direction }, RULES);
}

// ─── toNirRow ────────────────────────────────────────────────────────────────

describe('toNirRow', () => {
  it('coerces every NUMERIC string to a number', () => {
    const r = toNirRow(apiReport(), TAKTS);

    expect(r.oil).toBe(17.4);
    expect(r.water).toBe(53);
    expect(r.dry).toBe(37.02);
    expect(r.green).toBe(12);
    expect(r.acid).toBe(0.35);
    expect(r.maturity).toBe(3.2);
    expect(r.irrigAmount).toBe(1.5);
    // Not "17.40" — the whole reason this module exists.
    expect(typeof r.oil).toBe('number');
  });

  it('keeps only the calendar day from a timestamptz report_date', () => {
    expect(toNirRow(apiReport(), TAKTS).reportDate).toBe('2026-09-12');
  });

  it('resolves sub_area_id to a takt name', () => {
    expect(toNirRow(apiReport(), TAKTS).subAreaName).toBe('טאקט א');
  });

  it('leaves an unknown takt id nameless rather than guessing', () => {
    const r = toNirRow(apiReport({ detail: { sub_area_id: 'ghost' } }), TAKTS);
    expect(r.subAreaId).toBe('ghost');
    expect(r.subAreaName).toBeNull();
  });

  it('maps a missing detail, area and worker to nulls, not crashes', () => {
    const r = toNirRow(
      apiReport({ detail: null, area: null, worker: null, description: null }),
      TAKTS
    );
    expect(r.oil).toBeNull();
    expect(r.areaName).toBe('');
    expect(r.workerName).toBe('');
    expect(r.notes).toBe('');
  });

  it('treats an empty-string measurement as missing, not as zero', () => {
    const r = toNirRow(apiReport({ detail: { oil: '', water: null } }), TAKTS);
    expect(r.oil).toBeNull();
    expect(r.water).toBeNull();
  });

  it('exposes report_areas.id as the row key, not the detail row', () => {
    expect(toNirRow(apiReport(), TAKTS).id).toBe('ra-1');
  });
});

// ─── sorting ─────────────────────────────────────────────────────────────────

describe('sortNirRows', () => {
  it('sorts numerics numerically, not lexically', () => {
    // The regression this module exists to prevent: as strings, "9" > "17".
    const rows = [row({ id: 'a', oil: 9 }), row({ id: 'b', oil: 17 }), row({ id: 'c', oil: 8.5 })];
    expect(sortBy(rows, 'oil').map((r) => r.id)).toEqual(['c', 'a', 'b']);
    expect(sortBy(rows, 'oil', 'desc').map((r) => r.id)).toEqual(['b', 'a', 'c']);
  });

  it('puts nulls last in BOTH directions', () => {
    const rows = [
      row({ id: 'none', oil: null }),
      row({ id: 'low', oil: 12 }),
      row({ id: 'high', oil: 22 }),
    ];
    expect(sortBy(rows, 'oil', 'asc').map((r) => r.id)).toEqual(['low', 'high', 'none']);
    expect(sortBy(rows, 'oil', 'desc').map((r) => r.id)).toEqual(['high', 'low', 'none']);
  });

  it('collates plot names in Hebrew', () => {
    const rows = [
      row({ id: 'c', areaName: 'תל' }),
      row({ id: 'a', areaName: 'אלון' }),
      row({ id: 'b', areaName: 'גבעה' }),
    ];
    expect(sortBy(rows, 'areaName').map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });

  it('orders status by severity, not by the Hebrew message', () => {
    const rows = [
      row({ id: 'urgent', oil: 25 }), // > 20  → urgent, severity 3
      row({ id: 'idle', oil: 10 }), //  < 17  → idle,   severity 0
      row({ id: 'plan', oil: 19 }), //  17–20 → plan,   severity 2
    ];
    expect(sortBy(rows, 'status').map((r) => r.id)).toEqual(['idle', 'plan', 'urgent']);
  });

  it('sorts an unscored row last under status, in both directions', () => {
    const rows = [row({ id: 'scored', oil: 19 }), row({ id: 'blank', oil: null })];
    expect(sortBy(rows, 'status', 'asc').map((r) => r.id)).toEqual(['scored', 'blank']);
    expect(sortBy(rows, 'status', 'desc').map((r) => r.id)).toEqual(['scored', 'blank']);
  });

  it('sorts dates chronologically and keeps null dates last', () => {
    const rows = [
      row({ id: 'sep', reportDate: '2026-09-01' }),
      row({ id: 'none', reportDate: null }),
      row({ id: 'jan', reportDate: '2026-01-15' }),
    ];
    expect(sortBy(rows, 'reportDate', 'desc').map((r) => r.id)).toEqual(['sep', 'jan', 'none']);
  });

  it('breaks ties on created_at descending, matching the server order', () => {
    const rows = [
      row({ id: 'older', reportDate: '2026-09-01', createdAt: '2026-09-01T07:00:00Z' }),
      row({ id: 'newer', reportDate: '2026-09-01', createdAt: '2026-09-01T09:00:00Z' }),
    ];
    expect(sortBy(rows, 'reportDate', 'desc').map((r) => r.id)).toEqual(['newer', 'older']);
    expect(sortBy(rows, 'reportDate', 'asc').map((r) => r.id)).toEqual(['newer', 'older']);
  });

  it('does not mutate the input array', () => {
    const rows = [row({ id: 'b', oil: 20 }), row({ id: 'a', oil: 10 })];
    sortBy(rows, 'oil');
    expect(rows.map((r) => r.id)).toEqual(['b', 'a']);
  });
});

// ─── filtering ───────────────────────────────────────────────────────────────

describe('filterNirRows', () => {
  const rows = [
    row({
      id: 'a',
      areaId: 'area-1',
      areaName: 'מיצר',
      variety: 'ארבקינה',
      oil: 25,
      direction: 'צפון',
      workerName: 'דני',
      reportNumber: 101,
    }),
    row({
      id: 'b',
      areaId: 'area-2',
      areaName: 'גבעה',
      variety: 'קורונייקי',
      oil: 12,
      direction: 'דרום',
      notes: 'עצים צעירים',
    }),
    row({ id: 'c', areaId: 'area-2', areaName: 'גבעה', oil: null, direction: null }),
  ];

  const filter = (overrides: Partial<typeof EMPTY_NIR_FILTERS>) =>
    filterNirRows(rows, { ...EMPTY_NIR_FILTERS, ...overrides }, RULES).map((r) => r.id);

  it('returns everything when nothing is set', () => {
    expect(filter({})).toEqual(['a', 'b', 'c']);
  });

  it('treats both "" and "all" as no plot filter', () => {
    // SearchableSelect's clear button emits '', the Select placeholder uses 'all'.
    expect(filter({ areaId: '' })).toEqual(['a', 'b', 'c']);
    expect(filter({ areaId: 'all' })).toEqual(['a', 'b', 'c']);
  });

  it('filters by plot', () => {
    expect(filter({ areaId: 'area-2' })).toEqual(['b', 'c']);
  });

  it('filters by the oil verdict', () => {
    expect(filter({ status: ParameterStatus.URGENT })).toEqual(['a']);
    expect(filter({ status: ParameterStatus.IDLE })).toEqual(['b']);
  });

  it('filters down to rows with no oil reading to score', () => {
    expect(filter({ status: 'none' })).toEqual(['c']);
  });

  it('filters by sample direction', () => {
    expect(filter({ direction: 'דרום' })).toEqual(['b']);
  });

  it('searches plot name, variety, worker, notes and report number', () => {
    expect(filter({ search: 'מיצר' })).toEqual(['a']);
    expect(filter({ search: 'קורונייקי' })).toEqual(['b']);
    expect(filter({ search: 'דני' })).toEqual(['a']);
    expect(filter({ search: 'צעירים' })).toEqual(['b']);
    expect(filter({ search: '101' })).toEqual(['a']);
  });

  it('ignores surrounding whitespace in the search term', () => {
    expect(filter({ search: '  מיצר  ' })).toEqual(['a']);
  });

  it('combines filters with AND', () => {
    expect(filter({ areaId: 'area-2', direction: 'דרום' })).toEqual(['b']);
    expect(filter({ areaId: 'area-1', direction: 'דרום' })).toEqual([]);
  });
});

describe('hasActiveNirFilters', () => {
  it('is false for the empty set', () => {
    expect(hasActiveNirFilters(EMPTY_NIR_FILTERS)).toBe(false);
  });

  it('is false for a plot cleared to either sentinel', () => {
    expect(hasActiveNirFilters({ ...EMPTY_NIR_FILTERS, areaId: 'all' })).toBe(false);
  });

  it('is false for a search of only whitespace', () => {
    expect(hasActiveNirFilters({ ...EMPTY_NIR_FILTERS, search: '   ' })).toBe(false);
  });

  it('is true once any filter is set', () => {
    expect(hasActiveNirFilters({ ...EMPTY_NIR_FILTERS, areaId: 'area-1' })).toBe(true);
    expect(hasActiveNirFilters({ ...EMPTY_NIR_FILTERS, status: ParameterStatus.PLAN })).toBe(true);
    expect(hasActiveNirFilters({ ...EMPTY_NIR_FILTERS, direction: 'צפון' })).toBe(true);
    expect(hasActiveNirFilters({ ...EMPTY_NIR_FILTERS, search: 'מיצר' })).toBe(true);
  });
});
