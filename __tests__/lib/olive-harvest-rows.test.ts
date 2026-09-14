import { describe, it, expect } from 'vitest';
import {
  toHarvestRow,
  filterHarvestRows,
  sortHarvestRows,
  hasActiveHarvestFilters,
  EMPTY_HARVEST_FILTERS,
  type HarvestRow,
  type HarvestSortField,
} from '@/lib/olive/harvest-rows';
import { HarvesterType } from '@/types/database';

/**
 * The harvest log's row model.
 *
 * Same hazard as the NIR rows: PostgREST sends NUMERIC as a string, and the old
 * log printed those straight into the cell — a pass of 1234 kg rendered as
 * "1234.00" and would have sorted next to "13".
 */

const TAKTS = new Map([
  ['takt-1', 'טאקט א'],
  ['takt-2', 'טאקט ב'],
]);

function apiReport(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'ra-1',
    report_number: 210,
    report_date: '2026-11-12T00:00:00+00:00',
    created_at: '2026-11-12T08:00:00Z',
    description: 'מעבר ראשון',
    status: 'completed',
    area: { id: 'area-1', name: 'מיצר', variety: 'ארבקינה', size: '48.00' },
    worker: { id: 'w-1', name: 'דני' },
    detail: {
      report_area_id: 'ra-1',
      sub_area_id: 'takt-1',
      pass_number: 2,
      harvester_type: HarvesterType.X9090,
      operator: 'יוסי',
      area_done_dunam: '20.00',
      fruit_kg: '5000.00',
      oil_kg: '900.00',
      is_final: false,
    },
    ...overrides,
  };
}

function row(overrides: Partial<HarvestRow> = {}): HarvestRow {
  return {
    id: 'ra-x',
    reportNumber: null,
    reportDate: '2026-11-01',
    createdAt: '2026-11-01T00:00:00Z',
    areaId: 'area-1',
    areaName: 'מיצר',
    variety: null,
    plotSize: null,
    workerName: '',
    subAreaId: null,
    subAreaName: null,
    passNumber: null,
    harvesterType: null,
    harvesterLabel: null,
    operator: null,
    areaDoneDunam: null,
    fruitKg: null,
    oilKg: null,
    isFinal: false,
    kgPerDunam: null,
    oilPercent: null,
    notes: '',
    raw: {},
    ...overrides,
  };
}

function sortBy(rows: HarvestRow[], field: HarvestSortField, direction: 'asc' | 'desc' = 'asc') {
  return sortHarvestRows(rows, { field, direction });
}

// ─── toHarvestRow ────────────────────────────────────────────────────────────

describe('toHarvestRow', () => {
  it('coerces every NUMERIC string to a number', () => {
    const r = toHarvestRow(apiReport(), TAKTS);
    expect(r.areaDoneDunam).toBe(20);
    expect(r.fruitKg).toBe(5000);
    expect(r.oilKg).toBe(900);
    expect(r.plotSize).toBe(48);
    expect(typeof r.fruitKg).toBe('number');
  });

  it('derives kg per dunam and oil percent', () => {
    const r = toHarvestRow(apiReport(), TAKTS);
    expect(r.kgPerDunam).toBe(250); // 5000 / 20
    expect(r.oilPercent).toBeCloseTo(18, 5); // 900 / 5000
  });

  it('leaves the ratios null rather than dividing by zero', () => {
    const noArea = toHarvestRow(
      apiReport({ detail: { fruit_kg: '100', area_done_dunam: '0' } }),
      TAKTS
    );
    expect(noArea.kgPerDunam).toBeNull();

    const noFruit = toHarvestRow(apiReport({ detail: { oil_kg: '10', fruit_kg: '0' } }), TAKTS);
    expect(noFruit.oilPercent).toBeNull();

    const missing = toHarvestRow(apiReport({ detail: { fruit_kg: '100' } }), TAKTS);
    expect(missing.kgPerDunam).toBeNull();
  });

  it('labels a known harvester and passes an unknown one through', () => {
    expect(toHarvestRow(apiReport(), TAKTS).harvesterLabel).toBe('ניו הולנד 9090X');
    // The column is bare TEXT with no CHECK, so this is reachable.
    const odd = toHarvestRow(apiReport({ detail: { harvester_type: 'קבלן של השכן' } }), TAKTS);
    expect(odd.harvesterLabel).toBe('קבלן של השכן');
  });

  it('leaves harvesterLabel null when no equipment was recorded', () => {
    expect(toHarvestRow(apiReport({ detail: {} }), TAKTS).harvesterLabel).toBeNull();
  });

  it('keeps only the calendar day from a timestamptz report_date', () => {
    expect(toHarvestRow(apiReport(), TAKTS).reportDate).toBe('2026-11-12');
  });

  it('resolves sub_area_id to a takt name', () => {
    expect(toHarvestRow(apiReport(), TAKTS).subAreaName).toBe('טאקט א');
  });

  it('coerces is_final to a real boolean', () => {
    expect(toHarvestRow(apiReport(), TAKTS).isFinal).toBe(false);
    expect(toHarvestRow(apiReport({ detail: { is_final: true } }), TAKTS).isFinal).toBe(true);
    expect(toHarvestRow(apiReport({ detail: {} }), TAKTS).isFinal).toBe(false);
  });

  it('survives a missing detail, area and worker', () => {
    const r = toHarvestRow(
      apiReport({ detail: null, area: null, worker: null, description: null }),
      TAKTS
    );
    expect(r.fruitKg).toBeNull();
    expect(r.areaName).toBe('');
    expect(r.workerName).toBe('');
    expect(r.notes).toBe('');
    expect(r.isFinal).toBe(false);
  });

  it('exposes report_areas.id as the row key', () => {
    expect(toHarvestRow(apiReport(), TAKTS).id).toBe('ra-1');
  });
});

// ─── sorting ─────────────────────────────────────────────────────────────────

describe('sortHarvestRows', () => {
  it('sorts weights numerically, not lexically', () => {
    // As strings "9" > "1234"; this is the bug the old log would have shipped.
    const rows = [
      row({ id: 'a', fruitKg: 9 }),
      row({ id: 'b', fruitKg: 1234 }),
      row({ id: 'c', fruitKg: 130 }),
    ];
    expect(sortBy(rows, 'fruitKg').map((r) => r.id)).toEqual(['a', 'c', 'b']);
    expect(sortBy(rows, 'fruitKg', 'desc').map((r) => r.id)).toEqual(['b', 'c', 'a']);
  });

  it('sorts pass numbers numerically', () => {
    const rows = [row({ id: 'p10', passNumber: 10 }), row({ id: 'p2', passNumber: 2 })];
    expect(sortBy(rows, 'passNumber').map((r) => r.id)).toEqual(['p2', 'p10']);
  });

  it('sorts the derived kg-per-dunam column', () => {
    const rows = [
      row({ id: 'low', kgPerDunam: 90 }),
      row({ id: 'high', kgPerDunam: 400 }),
      row({ id: 'mid', kgPerDunam: 250 }),
    ];
    expect(sortBy(rows, 'kgPerDunam').map((r) => r.id)).toEqual(['low', 'mid', 'high']);
  });

  it('puts nulls last in BOTH directions', () => {
    const rows = [
      row({ id: 'none', oilKg: null }),
      row({ id: 'low', oilKg: 10 }),
      row({ id: 'high', oilKg: 99 }),
    ];
    expect(sortBy(rows, 'oilKg', 'asc').map((r) => r.id)).toEqual(['low', 'high', 'none']);
    expect(sortBy(rows, 'oilKg', 'desc').map((r) => r.id)).toEqual(['high', 'low', 'none']);
  });

  it('collates plot names in Hebrew', () => {
    const rows = [
      row({ id: 'c', areaName: 'תל' }),
      row({ id: 'a', areaName: 'אלון' }),
      row({ id: 'b', areaName: 'גבעה' }),
    ];
    expect(sortBy(rows, 'areaName').map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });

  it('sorts final passes after partial ones ascending', () => {
    const rows = [row({ id: 'final', isFinal: true }), row({ id: 'partial', isFinal: false })];
    expect(sortBy(rows, 'isFinal', 'asc').map((r) => r.id)).toEqual(['partial', 'final']);
    expect(sortBy(rows, 'isFinal', 'desc').map((r) => r.id)).toEqual(['final', 'partial']);
  });

  it('breaks ties on created_at descending', () => {
    const rows = [
      row({ id: 'older', reportDate: '2026-11-01', createdAt: '2026-11-01T07:00:00Z' }),
      row({ id: 'newer', reportDate: '2026-11-01', createdAt: '2026-11-01T09:00:00Z' }),
    ];
    expect(sortBy(rows, 'reportDate', 'desc').map((r) => r.id)).toEqual(['newer', 'older']);
  });

  it('does not mutate the input array', () => {
    const rows = [row({ id: 'b', fruitKg: 20 }), row({ id: 'a', fruitKg: 10 })];
    sortBy(rows, 'fruitKg');
    expect(rows.map((r) => r.id)).toEqual(['b', 'a']);
  });
});

// ─── filtering ───────────────────────────────────────────────────────────────

describe('filterHarvestRows', () => {
  const rows = [
    row({
      id: 'a',
      areaId: 'area-1',
      areaName: 'מיצר',
      variety: 'ארבקינה',
      harvesterType: HarvesterType.X9090,
      harvesterLabel: 'ניו הולנד 9090X',
      operator: 'יוסי',
      isFinal: true,
      reportNumber: 210,
    }),
    row({
      id: 'b',
      areaId: 'area-2',
      areaName: 'גבעה',
      harvesterType: HarvesterType.X1190,
      harvesterLabel: 'ניו הולנד 11.90X כפולה',
      notes: 'עצירה בגלל גשם',
    }),
    row({ id: 'c', areaId: 'area-2', areaName: 'גבעה', harvesterType: null }),
  ];

  const filter = (overrides: Partial<typeof EMPTY_HARVEST_FILTERS>) =>
    filterHarvestRows(rows, { ...EMPTY_HARVEST_FILTERS, ...overrides }).map((r) => r.id);

  it('returns everything when nothing is set', () => {
    expect(filter({})).toEqual(['a', 'b', 'c']);
  });

  it('treats both "" and "all" as no plot filter', () => {
    expect(filter({ areaId: '' })).toEqual(['a', 'b', 'c']);
    expect(filter({ areaId: 'all' })).toEqual(['a', 'b', 'c']);
  });

  it('filters by plot', () => {
    expect(filter({ areaId: 'area-2' })).toEqual(['b', 'c']);
  });

  it('filters by harvester', () => {
    expect(filter({ harvester: HarvesterType.X9090 })).toEqual(['a']);
  });

  it('filters down to passes with no equipment recorded', () => {
    expect(filter({ harvester: 'none' })).toEqual(['c']);
  });

  it('filters by finality both ways', () => {
    expect(filter({ finality: 'final' })).toEqual(['a']);
    expect(filter({ finality: 'partial' })).toEqual(['b', 'c']);
  });

  it('searches plot, variety, operator, notes, harvester label and report number', () => {
    expect(filter({ search: 'מיצר' })).toEqual(['a']);
    expect(filter({ search: 'ארבקינה' })).toEqual(['a']);
    expect(filter({ search: 'יוסי' })).toEqual(['a']);
    expect(filter({ search: 'גשם' })).toEqual(['b']);
    expect(filter({ search: '9090' })).toEqual(['a']);
    expect(filter({ search: '210' })).toEqual(['a']);
  });

  it('ignores surrounding whitespace in the search term', () => {
    expect(filter({ search: '  מיצר  ' })).toEqual(['a']);
  });

  it('combines filters with AND', () => {
    expect(filter({ areaId: 'area-2', finality: 'partial' })).toEqual(['b', 'c']);
    expect(filter({ areaId: 'area-1', finality: 'partial' })).toEqual([]);
  });
});

describe('hasActiveHarvestFilters', () => {
  it('is false for the empty set', () => {
    expect(hasActiveHarvestFilters(EMPTY_HARVEST_FILTERS)).toBe(false);
  });

  it('is false for a plot cleared to either sentinel', () => {
    expect(hasActiveHarvestFilters({ ...EMPTY_HARVEST_FILTERS, areaId: 'all' })).toBe(false);
  });

  it('is false for a search of only whitespace', () => {
    expect(hasActiveHarvestFilters({ ...EMPTY_HARVEST_FILTERS, search: '   ' })).toBe(false);
  });

  it('is true once any filter is set', () => {
    expect(hasActiveHarvestFilters({ ...EMPTY_HARVEST_FILTERS, areaId: 'area-1' })).toBe(true);
    expect(hasActiveHarvestFilters({ ...EMPTY_HARVEST_FILTERS, harvester: 'none' })).toBe(true);
    expect(hasActiveHarvestFilters({ ...EMPTY_HARVEST_FILTERS, finality: 'final' })).toBe(true);
    expect(hasActiveHarvestFilters({ ...EMPTY_HARVEST_FILTERS, search: 'מיצר' })).toBe(true);
  });
});
