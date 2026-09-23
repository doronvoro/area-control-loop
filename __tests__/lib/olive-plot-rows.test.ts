import { describe, it, expect } from 'vitest';
import {
  toPlotRow,
  filterPlotRows,
  sortPlotRows,
  hasActivePlotFilters,
  countActivePlotFilters,
  plotTypeCounts,
  categoryLabel,
  nextOilWaterSort,
  EMPTY_PLOT_FILTERS,
  type PlotRow,
  type PlotSortField,
} from '@/lib/olive/plot-rows';
import type { ApiPlot } from '@/lib/olive/adapt';
import { NONE } from '@/lib/forms/none-sentinel';
import { PlotType } from '@/types/database';

const NOW = new Date('2026-09-15T10:00:00');

function apiPlot(overrides: Partial<ApiPlot> = {}): ApiPlot {
  return {
    id: 'area-1',
    name: 'מיצר — 2003 — ארבקינה',
    variety: 'ארבקינה',
    planting_time: '2003',
    size: '48.00',
    details: {
      grower_id: 'g-1',
      grower_name: 'ארץ גשור',
      region: 'גולן',
      plot_type: PlotType.OWNER,
      harvester: '9090x',
      water_type: 'fresh',
      takt_count: 3,
      plant_year_label: '2003',
    },
    takts: [
      { id: 't1', name: 'טאקט א' },
      { id: 't2', name: 'טאקט ב' },
    ],
    ...overrides,
  } as ApiPlot;
}

function build(overrides: Partial<Parameters<typeof toPlotRow>[0]> = {}) {
  return toPlotRow({
    plot: apiPlot(),
    nir: { report_date: '2026-09-08', oil: 18.4, water: 55, dry: 40.9 },
    category: 'normal',
    harvested: false,
    yieldEstimate: { kg_per_dunam: '1400.00' },
    now: NOW,
    ...overrides,
  });
}

function row(overrides: Partial<PlotRow> = {}): PlotRow {
  return {
    id: 'p',
    name: 'מיצר',
    variety: null,
    growerId: null,
    growerName: null,
    plotType: null,
    region: null,
    waterType: null,
    harvester: null,
    plantYear: null,
    size: null,
    taktCount: 0,
    category: 'testing',
    harvested: false,
    daysSinceNir: null,
    nirCountInSeason: 0,
    lastMeasuredLabel: null,
    nirSentToClientAt: null,
    oil: null,
    water: null,
    dry: null,
    yieldKgPerDunam: null,
    yieldLoad: null,
    plot: apiPlot(),
    ...overrides,
  };
}

function sortBy(rows: PlotRow[], field: PlotSortField, direction: 'asc' | 'desc' = 'asc') {
  return sortPlotRows(rows, { field, direction });
}

// ─── toPlotRow ───────────────────────────────────────────────────────────────

describe('toPlotRow', () => {
  it('coerces NUMERIC strings on the plot and its measurement', () => {
    const r = build();
    expect(r.size).toBe(48);
    expect(r.yieldKgPerDunam).toBe(1400);
    expect(typeof r.size).toBe('number');
  });

  it('lifts the NIR measurements onto the row', () => {
    const r = build();
    expect(r.oil).toBe(18.4);
    expect(r.water).toBe(55);
    expect(r.dry).toBe(40.9);
  });

  it('counts the takts that actually exist, not the planned figure', () => {
    // takt_count is a planned number someone types into the details dialog;
    // takts is the real sub_areas list. The list wins wherever it was loaded,
    // including when it is empty.
    expect(build().taktCount).toBe(2); // two real takts beat takt_count: 3
    expect(build({ plot: apiPlot({ takts: [] }) }).taktCount).toBe(0);
  });

  it('falls back to the stored count only when no list was loaded at all', () => {
    expect(build({ plot: apiPlot({ takts: undefined }) }).taktCount).toBe(3);
  });

  it('derives both a sortable day count and its label from the same date', () => {
    const r = build();
    expect(r.daysSinceNir).toBe(7);
    expect(r.lastMeasuredLabel).toBe('לפני 7 ימים');
  });

  it('leaves a never-measured plot null rather than zero', () => {
    const r = build({ nir: null });
    expect(r.daysSinceNir).toBeNull();
    expect(r.lastMeasuredLabel).toBeNull();
    expect(r.oil).toBeNull();
  });

  it('bands the yield load', () => {
    expect(build().yieldLoad?.label).toBe('עומס יבול: גבוה'); // 1400 > 1300
    expect(build({ yieldEstimate: { kg_per_dunam: '1000' } }).yieldLoad?.label).toBe(
      'עומס יבול: בינוני'
    );
    expect(build({ yieldEstimate: null }).yieldLoad).toBeNull();
  });

  it('lifts the grower id, which is what the filter matches on', () => {
    expect(build().growerId).toBe('g-1');
  });

  it('survives a plot with no details row', () => {
    const r = build({ plot: apiPlot({ details: null, takts: [] }) });
    expect(r.growerId).toBeNull();
    expect(r.growerName).toBeNull();
    expect(r.region).toBeNull();
    expect(r.plotType).toBeNull();
    expect(r.taktCount).toBe(0);
  });
});

// ─── sorting ─────────────────────────────────────────────────────────────────

describe('sortPlotRows', () => {
  it('collates plot names in Hebrew', () => {
    const rows = [
      row({ id: 'c', name: 'תל' }),
      row({ id: 'a', name: 'אלון' }),
      row({ id: 'b', name: 'גבעה' }),
    ];
    expect(sortBy(rows, 'name').map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });

  it('sorts size numerically, not lexically', () => {
    // As strings "9" > "48".
    const rows = [
      row({ id: 'a', size: 9 }),
      row({ id: 'b', size: 48 }),
      row({ id: 'c', size: 130 }),
    ];
    expect(sortBy(rows, 'size').map((r) => r.id)).toEqual(['a', 'b', 'c']);
  });

  it('sorts days-since-NIR so the most overdue can be found', () => {
    const rows = [row({ id: 'fresh', daysSinceNir: 2 }), row({ id: 'stale', daysSinceNir: 40 })];
    expect(sortBy(rows, 'daysSinceNir', 'desc').map((r) => r.id)).toEqual(['stale', 'fresh']);
  });

  it('puts never-measured plots last in BOTH directions', () => {
    const rows = [
      row({ id: 'never', daysSinceNir: null }),
      row({ id: 'fresh', daysSinceNir: 2 }),
      row({ id: 'stale', daysSinceNir: 40 }),
    ];
    expect(sortBy(rows, 'daysSinceNir', 'asc').map((r) => r.id)).toEqual([
      'fresh',
      'stale',
      'never',
    ]);
    expect(sortBy(rows, 'daysSinceNir', 'desc').map((r) => r.id)).toEqual([
      'stale',
      'fresh',
      'never',
    ]);
  });

  it('orders the category column the way the dashboard cards are ordered', () => {
    const rows = [
      row({ id: 'ready', category: 'ready' }),
      row({ id: 'testing', category: 'testing' }),
      row({ id: 'anomaly', category: 'anomaly' }),
      row({ id: 'normal', category: 'normal' }),
    ];
    expect(sortBy(rows, 'category').map((r) => r.id)).toEqual([
      'testing',
      'normal',
      'anomaly',
      'ready',
    ]);
  });

  it('sorts a missing grower last, not first', () => {
    const rows = [
      row({ id: 'none', growerName: null }),
      row({ id: 'has', growerName: 'ארץ גשור' }),
    ];
    expect(sortBy(rows, 'growerName', 'asc').map((r) => r.id)).toEqual(['has', 'none']);
    expect(sortBy(rows, 'growerName', 'desc').map((r) => r.id)).toEqual(['has', 'none']);
  });

  it('breaks ties on plot name', () => {
    const rows = [row({ id: 'b', size: 10, name: 'ב' }), row({ id: 'a', size: 10, name: 'א' })];
    expect(sortBy(rows, 'size').map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('does not mutate the input array', () => {
    const rows = [row({ id: 'b', size: 20 }), row({ id: 'a', size: 10 })];
    sortBy(rows, 'size');
    expect(rows.map((r) => r.id)).toEqual(['b', 'a']);
  });
});

// ─── filtering ───────────────────────────────────────────────────────────────

describe('filterPlotRows', () => {
  const rows = [
    row({
      id: 'a',
      name: 'מיצר — 2003 — ארבקינה',
      variety: 'ארבקינה',
      growerId: 'g-1',
      growerName: 'ארץ גשור',
      plotType: PlotType.OWNER,
      region: 'גולן',
      category: 'ready',
      harvested: true,
      daysSinceNir: 3,
    }),
    row({
      id: 'b',
      name: 'גבעה',
      growerId: 'g-2',
      plotType: PlotType.PARTNER,
      category: 'anomaly',
      harvested: false,
      daysSinceNir: 30,
    }),
    // No grower at all — what the NONE option is for.
    row({
      id: 'c',
      name: 'תל',
      growerId: null,
      plotType: PlotType.PARTNER,
      category: 'testing',
      daysSinceNir: null,
    }),
  ];

  const filter = (overrides: Partial<typeof EMPTY_PLOT_FILTERS>) =>
    filterPlotRows(rows, { ...EMPTY_PLOT_FILTERS, ...overrides }).map((r) => r.id);

  it('returns everything when nothing is set', () => {
    expect(filter({})).toEqual(['a', 'b', 'c']);
  });

  it('filters by grower type', () => {
    expect(filter({ plotType: PlotType.PARTNER })).toEqual(['b', 'c']);
  });

  it('filters by category', () => {
    expect(filter({ category: 'ready' })).toEqual(['a']);
  });

  it('filters harvested and active both ways', () => {
    expect(filter({ harvest: 'harvested' })).toEqual(['a']);
    expect(filter({ harvest: 'active' })).toEqual(['b', 'c']);
  });

  it('separates measured plots from never-measured ones', () => {
    expect(filter({ nir: 'measured' })).toEqual(['a', 'b']);
    expect(filter({ nir: 'never' })).toEqual(['c']);
  });

  it('searches name, variety, region and grower', () => {
    expect(filter({ search: 'מיצר' })).toEqual(['a']);
    expect(filter({ search: 'גולן' })).toEqual(['a']);
    expect(filter({ search: 'גשור' })).toEqual(['a']);
  });

  it('matches the Hebrew initials of a plot name', () => {
    // plotMatchesSearch splits on spaces, dashes and middots and takes the
    // first character of each part — so the planting year is a "word" too and
    // "מיצר — 2003 — ארבקינה" has the initials "מ2א", not "מא".
    expect(filter({ search: 'מ2א' })).toEqual(['a']);
    expect(filter({ search: 'מא' })).toEqual([]);
  });

  it('filters by grower id', () => {
    expect(filter({ growerId: 'g-1' })).toEqual(['a']);
    expect(filter({ growerId: 'g-2' })).toEqual(['b']);
  });

  it('treats both spellings of "no grower filter" as no filter', () => {
    // '' is what SearchableSelect's clear button emits; 'all' is the vocabulary
    // every other filter here uses, and handing it over must not empty the list.
    expect(filter({ growerId: '' })).toEqual(['a', 'b', 'c']);
    expect(filter({ growerId: 'all' })).toEqual(['a', 'b', 'c']);
  });

  it('finds the plots with no grower at all', () => {
    expect(filter({ growerId: NONE })).toEqual(['c']);
  });

  it('combines filters with AND', () => {
    expect(filter({ plotType: PlotType.PARTNER, category: 'testing' })).toEqual(['c']);
    expect(filter({ plotType: PlotType.OWNER, category: 'testing' })).toEqual([]);
    expect(filter({ growerId: 'g-2', plotType: PlotType.PARTNER })).toEqual(['b']);
    expect(filter({ growerId: 'g-2', plotType: PlotType.OWNER })).toEqual([]);
  });
});

// ─── chip counts ─────────────────────────────────────────────────────────────

describe('plotTypeCounts', () => {
  const rows = [
    row({ id: 'a', name: 'מיצר', growerId: 'g-1', plotType: PlotType.OWNER, category: 'ready' }),
    row({ id: 'b', name: 'גבעה', growerId: 'g-2', plotType: PlotType.PARTNER }),
    row({ id: 'c', name: 'תל', plotType: PlotType.PARTNER }),
    // Never classified. It is in `all` and in no chip.
    row({ id: 'd', name: 'רמה', plotType: null }),
  ];

  const counts = (overrides: Partial<typeof EMPTY_PLOT_FILTERS> = {}) =>
    plotTypeCounts(rows, { ...EMPTY_PLOT_FILTERS, ...overrides });

  it('counts everything when nothing is set', () => {
    expect(counts().all).toBe(4);
    expect(counts()[PlotType.OWNER]).toBe(1);
    expect(counts()[PlotType.PARTNER]).toBe(2);
  });

  it('leaves an unclassified plot out of every chip but inside all', () => {
    // The chips deliberately do not sum to `all` — dropping 'רמה' from `all`
    // would make the table show a plot the הכל chip does not admit exists.
    const c = counts();
    expect(c.all).toBe(4);
    expect((c[PlotType.OWNER] ?? 0) + (c[PlotType.PARTNER] ?? 0)).toBe(3);
  });

  it('respects the other filters, so a chip cannot promise more than the table shows', () => {
    const c = counts({ category: 'ready' });
    expect(c.all).toBe(1);
    expect(c[PlotType.OWNER]).toBe(1);
    expect(c[PlotType.PARTNER]).toBeUndefined();
  });

  it('ignores plotType itself, so clicking a chip does not rewrite the counts', () => {
    expect(counts({ plotType: PlotType.OWNER })).toEqual(counts());
  });
});

describe('hasActivePlotFilters', () => {
  it('is false for the empty set', () => {
    expect(hasActivePlotFilters(EMPTY_PLOT_FILTERS)).toBe(false);
  });

  it('is false for a search of only whitespace', () => {
    expect(hasActivePlotFilters({ ...EMPTY_PLOT_FILTERS, search: '   ' })).toBe(false);
  });

  it('is true once any filter is set', () => {
    expect(hasActivePlotFilters({ ...EMPTY_PLOT_FILTERS, plotType: PlotType.OWNER })).toBe(true);
    expect(hasActivePlotFilters({ ...EMPTY_PLOT_FILTERS, growerId: 'g-1' })).toBe(true);
    expect(hasActivePlotFilters({ ...EMPTY_PLOT_FILTERS, category: 'ready' })).toBe(true);
    expect(hasActivePlotFilters({ ...EMPTY_PLOT_FILTERS, harvest: 'active' })).toBe(true);
    expect(hasActivePlotFilters({ ...EMPTY_PLOT_FILTERS, nir: 'never' })).toBe(true);
  });

  it('is false for either spelling of an unset grower', () => {
    expect(hasActivePlotFilters({ ...EMPTY_PLOT_FILTERS, growerId: '' })).toBe(false);
    expect(hasActivePlotFilters({ ...EMPTY_PLOT_FILTERS, growerId: 'all' })).toBe(false);
  });
});

describe('countActivePlotFilters', () => {
  const count = (overrides: Partial<typeof EMPTY_PLOT_FILTERS> = {}) =>
    countActivePlotFilters({ ...EMPTY_PLOT_FILTERS, ...overrides });

  it('is zero for the empty set and for whitespace-only search', () => {
    expect(count()).toBe(0);
    expect(count({ search: '   ' })).toBe(0);
  });

  it('counts one per set filter', () => {
    expect(count({ search: 'מיצר' })).toBe(1);
    expect(count({ plotType: PlotType.OWNER })).toBe(1);
    expect(count({ growerId: 'g-1' })).toBe(1);
    expect(count({ category: 'ready' })).toBe(1);
    expect(count({ harvest: 'active' })).toBe(1);
    expect(count({ nir: 'never' })).toBe(1);
  });

  it('does not count an unset grower under either spelling', () => {
    expect(count({ growerId: '' })).toBe(0);
    expect(count({ growerId: 'all' })).toBe(0);
  });

  it('sums several', () => {
    expect(count({ search: 'מיצר', growerId: 'g-1', category: 'ready' })).toBe(3);
  });

  it('agrees with hasActivePlotFilters', () => {
    // The badge reads this number and the clear button reads that boolean; if
    // they ever disagree you get "מסונן (2)" beside a greyed-out נקה סינון.
    for (const overrides of [
      {},
      { search: '   ' },
      { growerId: 'all' },
      { growerId: 'g-1' },
      { nir: 'never' as const },
    ]) {
      const filters = { ...EMPTY_PLOT_FILTERS, ...overrides };
      expect(countActivePlotFilters(filters) > 0).toBe(hasActivePlotFilters(filters));
    }
  });
});

describe('oil and water sorting', () => {
  // The two now share one header, so nothing on screen says which of them a
  // click actually sorted by. These are what catch it being wired to the
  // wrong one: the orderings disagree on purpose.
  const rows = [
    row({ oil: 10, water: 60 }),
    row({ oil: 18, water: 50 }),
    row({ oil: 14, water: 70 }),
  ];

  it('sorts by oil independently of water', () => {
    expect(sortBy(rows, 'oil', 'desc').map((r) => r.oil)).toEqual([18, 14, 10]);
    expect(sortBy(rows, 'oil', 'asc').map((r) => r.oil)).toEqual([10, 14, 18]);
  });

  it('sorts by water independently of oil', () => {
    expect(sortBy(rows, 'water', 'desc').map((r) => r.water)).toEqual([70, 60, 50]);
    expect(sortBy(rows, 'water', 'asc').map((r) => r.water)).toEqual([50, 60, 70]);
  });

  it('puts a never-measured plot last in both directions', () => {
    const withGap = [row({ oil: 10 }), row({ oil: null }), row({ oil: 18 })];
    expect(sortBy(withGap, 'oil', 'desc').map((r) => r.oil)).toEqual([18, 10, null]);
    expect(sortBy(withGap, 'oil', 'asc').map((r) => r.oil)).toEqual([10, 18, null]);
  });
});

describe('nextOilWaterSort', () => {
  it('laps through all four states in four clicks', () => {
    // Four, not two: a bare oil↔water cycle would make ascending unreachable.
    let sort = nextOilWaterSort({ field: 'name', direction: 'asc' });
    expect(sort).toEqual({ field: 'oil', direction: 'desc' });

    sort = nextOilWaterSort(sort);
    expect(sort).toEqual({ field: 'water', direction: 'desc' });

    sort = nextOilWaterSort(sort);
    expect(sort).toEqual({ field: 'oil', direction: 'asc' });

    sort = nextOilWaterSort(sort);
    expect(sort).toEqual({ field: 'water', direction: 'asc' });

    expect(nextOilWaterSort(sort)).toEqual({ field: 'oil', direction: 'desc' });
  });

  it('enters at oil descending from any other column', () => {
    expect(nextOilWaterSort({ field: 'size', direction: 'asc' })).toEqual({
      field: 'oil',
      direction: 'desc',
    });
  });
});

describe('categoryLabel', () => {
  it('reads the label from the shared card definitions', () => {
    // Not a local copy: the page used to keep its own map, which had already
    // drifted from the dashboard's on two of the four labels.
    expect(categoryLabel('normal')).toBe('חלקות תקינות');
    expect(categoryLabel('anomaly')).toBe('חריגות');
    expect(categoryLabel('ready')).toBe('מוכן למסיק');
    expect(categoryLabel('testing')).toBe('בבדיקות');
  });
});
