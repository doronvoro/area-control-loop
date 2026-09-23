import { describe, it, expect } from 'vitest';
import {
  toGrowerRow,
  filterGrowerRows,
  sortGrowerRows,
  hasActiveGrowerFilters,
  EMPTY_GROWER_FILTERS,
  UNCLASSIFIED_LABEL,
  type GrowerRow,
  type GrowerSortField,
} from '@/lib/growers/grower-rows';
import {
  summarisePlotsByGrower,
  buildGrowerWrite,
  isGrowerType,
  normaliseAliases,
  diffAliases,
} from '@/lib/services/grower.service';
import { PLOT_TYPE_LABELS, PlotType } from '@/types/database';

/**
 * The growers grid.
 *
 * The roll-ups are the hazard here: plot_count and total_dunam come from a
 * NUMERIC sum over PostgREST, so they arrive as strings and would sort
 * lexically ("9" > "44") and render as "734.2999999999998" if trusted raw.
 */

function apiGrower(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'g-1',
    customer_id: 'c-1',
    name: 'קיבוץ גשור',
    grower_type: PlotType.OWNER,
    contact_person: 'דני כהן',
    contact_phone: '04-6961234',
    contact_mobile: '050-1234567',
    contact_email: 'office@example.com',
    address: 'רחוב הזיתים 1',
    city: 'קצרין',
    business_id: '512345678',
    notes: 'מגדל ותיק',
    is_active: true,
    plot_count: 44,
    total_dunam: 734.3,
    created_at: '2026-03-01T08:00:00Z',
    ...overrides,
  };
}

function row(overrides: Partial<GrowerRow> = {}): GrowerRow {
  return {
    id: 'g-x',
    name: 'מגדל',
    growerType: null,
    growerTypeLabel: UNCLASSIFIED_LABEL,
    aliases: [],
    contactPerson: null,
    contactPhone: null,
    contactMobile: null,
    contactEmail: null,
    address: null,
    city: null,
    businessId: null,
    notes: null,
    isActive: true,
    plotCount: 0,
    totalDunam: 0,
    createdAt: null,
    createdAtLabel: '—',
    ...overrides,
  };
}

/** A row carrying a type, with its label derived the way toGrowerRow derives it. */
function typedRow(type: PlotType, overrides: Partial<GrowerRow> = {}): GrowerRow {
  return row({ growerType: type, growerTypeLabel: PLOT_TYPE_LABELS[type], ...overrides });
}

function sortBy(rows: GrowerRow[], field: GrowerSortField, direction: 'asc' | 'desc') {
  return sortGrowerRows(rows, { field, direction });
}

describe('toGrowerRow', () => {
  it('flattens every field', () => {
    const r = toGrowerRow(apiGrower());
    expect(r.id).toBe('g-1');
    expect(r.name).toBe('קיבוץ גשור');
    expect(r.contactPerson).toBe('דני כהן');
    expect(r.city).toBe('קצרין');
    expect(r.businessId).toBe('512345678');
  });

  it('labels the three known types in Hebrew', () => {
    expect(toGrowerRow(apiGrower()).growerTypeLabel).toBe('ארץ גשור');
    expect(toGrowerRow(apiGrower({ grower_type: PlotType.PARTNER })).growerTypeLabel).toBe('שותף');
    expect(toGrowerRow(apiGrower({ grower_type: PlotType.OCCASIONAL })).growerTypeLabel).toBe(
      'מזדמן'
    );
  });

  it('falls back to the raw code for an unknown type, and labels null', () => {
    expect(toGrowerRow(apiGrower({ grower_type: 'lessee' })).growerTypeLabel).toBe('lessee');
    const none = toGrowerRow(apiGrower({ grower_type: null }));
    expect(none.growerType).toBeNull();
    expect(none.growerTypeLabel).toBe(UNCLASSIFIED_LABEL);
  });

  it('coerces the roll-ups, which arrive as strings from a NUMERIC sum', () => {
    const r = toGrowerRow(apiGrower({ plot_count: '44', total_dunam: '734.30' }));
    expect(r.plotCount).toBe(44);
    expect(r.totalDunam).toBe(734.3);
  });

  it('reads a missing or unparseable roll-up as 0, never NaN', () => {
    const { plot_count: _p, total_dunam: _d, ...without } = apiGrower();
    expect(toGrowerRow(without).plotCount).toBe(0);
    expect(toGrowerRow(apiGrower({ total_dunam: 'n/a' })).totalDunam).toBe(0);
  });

  it('reads a row with no is_active as active', () => {
    const { is_active: _omitted, ...without } = apiGrower();
    expect(toGrowerRow(without).isActive).toBe(true);
  });

  it('treats blank text as null', () => {
    const r = toGrowerRow(apiGrower({ city: '   ', notes: '' }));
    expect(r.city).toBeNull();
    expect(r.notes).toBeNull();
  });

  it('formats created_at as a he-IL date, and — when absent', () => {
    expect(toGrowerRow(apiGrower()).createdAtLabel).toBe(
      new Date('2026-03-01T08:00:00Z').toLocaleDateString('he-IL')
    );
    expect(toGrowerRow(apiGrower({ created_at: null })).createdAtLabel).toBe('—');
  });
});

describe('filterGrowerRows', () => {
  const rows = [
    typedRow(PlotType.OWNER, { id: 'a', name: 'קיבוץ גשור', city: 'קצרין', plotCount: 44 }),
    typedRow(PlotType.PARTNER, {
      id: 'b',
      name: 'זית בבית - אלעד',
      contactPerson: 'אלעד',
      plotCount: 2,
      isActive: false,
    }),
    row({ id: 'c', name: 'מגדל חדש', plotCount: 0 }),
  ];

  it('returns everything with no filters', () => {
    expect(filterGrowerRows(rows, EMPTY_GROWER_FILTERS)).toHaveLength(3);
  });

  it('filters by type, and by unclassified', () => {
    expect(
      filterGrowerRows(rows, { ...EMPTY_GROWER_FILTERS, growerType: PlotType.PARTNER }).map(
        (r) => r.id
      )
    ).toEqual(['b']);
    expect(
      filterGrowerRows(rows, { ...EMPTY_GROWER_FILTERS, growerType: 'none' }).map((r) => r.id)
    ).toEqual(['c']);
  });

  it('filters by status', () => {
    expect(
      filterGrowerRows(rows, { ...EMPTY_GROWER_FILTERS, status: 'inactive' }).map((r) => r.id)
    ).toEqual(['b']);
  });

  it('filters by whether the grower has plots', () => {
    expect(
      filterGrowerRows(rows, { ...EMPTY_GROWER_FILTERS, plots: 'with' }).map((r) => r.id)
    ).toEqual(['a', 'b']);
    expect(
      filterGrowerRows(rows, { ...EMPTY_GROWER_FILTERS, plots: 'without' }).map((r) => r.id)
    ).toEqual(['c']);
  });

  it.each([
    ['name', 'גשור', 'a'],
    ['contact person', 'אלעד', 'b'],
    ['city', 'קצרין', 'a'],
    ['type label', 'שותף', 'b'],
  ])('searches %s', (_label, term, expected) => {
    expect(
      filterGrowerRows(rows, { ...EMPTY_GROWER_FILTERS, search: term }).map((r) => r.id)
    ).toContain(expected);
  });

  it('searches case-insensitively', () => {
    const target = row({ id: 'target', contactEmail: 'Office@Example.com' });
    expect(
      filterGrowerRows([target], { ...EMPTY_GROWER_FILTERS, search: 'office@example' })
    ).toHaveLength(1);
  });
});

describe('sortGrowerRows', () => {
  it('sorts names with Hebrew collation', () => {
    const rows = [row({ name: 'תמר' }), row({ name: 'אבו' }), row({ name: 'מיצר' })];
    expect(sortBy(rows, 'name', 'asc').map((r) => r.name)).toEqual(['אבו', 'מיצר', 'תמר']);
  });

  it('sorts plot counts numerically, not lexically', () => {
    // The bug this guards: "9" > "44" as strings.
    const rows = [row({ id: 'a', plotCount: 44 }), row({ id: 'b', plotCount: 9 })];
    expect(sortBy(rows, 'plotCount', 'desc').map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('sorts dunam numerically', () => {
    const rows = [row({ id: 'a', totalDunam: 734.3 }), row({ id: 'b', totalDunam: 56 })];
    expect(sortBy(rows, 'totalDunam', 'desc').map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('sorts the type column in business order', () => {
    const rows = [
      typedRow(PlotType.OCCASIONAL, { id: 'o' }),
      typedRow(PlotType.OWNER, { id: 'w' }),
      typedRow(PlotType.PARTNER, { id: 'p' }),
    ];
    expect(sortBy(rows, 'growerType', 'asc').map((r) => r.id)).toEqual(['w', 'p', 'o']);
  });

  it.each(['asc', 'desc'] as const)('puts nulls last on %s', (direction) => {
    const rows = [
      row({ id: 'none', city: null }),
      row({ id: 'a', city: 'אלון' }),
      row({ id: 'z', city: 'קצרין' }),
    ];
    expect(sortBy(rows, 'city', direction).at(-1)?.id).toBe('none');
  });

  it('breaks ties by name', () => {
    const rows = [row({ name: 'תמר', plotCount: 3 }), row({ name: 'אבו', plotCount: 3 })];
    expect(sortBy(rows, 'plotCount', 'desc').map((r) => r.name)).toEqual(['אבו', 'תמר']);
  });

  it('does not mutate its input', () => {
    const rows = [row({ name: 'תמר' }), row({ name: 'אבו' })];
    sortBy(rows, 'name', 'asc');
    expect(rows.map((r) => r.name)).toEqual(['תמר', 'אבו']);
  });
});

describe('hasActiveGrowerFilters', () => {
  it('is false for the empty filters, and for a whitespace search', () => {
    expect(hasActiveGrowerFilters(EMPTY_GROWER_FILTERS)).toBe(false);
    expect(hasActiveGrowerFilters({ ...EMPTY_GROWER_FILTERS, search: '  ' })).toBe(false);
  });

  it.each([
    ['search', { search: 'גשור' }],
    ['type', { growerType: PlotType.OWNER as string }],
    ['status', { status: 'inactive' }],
    ['plots', { plots: 'without' }],
  ])('is true for an active %s filter', (_label, patch) => {
    expect(hasActiveGrowerFilters({ ...EMPTY_GROWER_FILTERS, ...patch })).toBe(true);
  });
});

describe('summarisePlotsByGrower', () => {
  it('counts plots and sums dunam per grower', () => {
    const summary = summarisePlotsByGrower([
      { details: { grower_id: 'g1' }, size: '20.00' },
      { details: { grower_id: 'g1' }, size: '28.00' },
      { details: { grower_id: 'g2' }, size: '56.00' },
    ]);
    expect(summary.get('g1')).toEqual({ count: 2, dunam: 48 });
    expect(summary.get('g2')).toEqual({ count: 1, dunam: 56 });
  });

  it('rounds a float-accumulated sum to one decimal', () => {
    const summary = summarisePlotsByGrower([
      { details: { grower_id: 'g1' }, size: '734.10' },
      { details: { grower_id: 'g1' }, size: '0.20' },
    ]);
    expect(summary.get('g1')?.dunam).toBe(734.3);
  });

  it('counts a plot whose size is missing, without poisoning the sum', () => {
    const summary = summarisePlotsByGrower([
      { details: { grower_id: 'g1' }, size: null },
      { details: { grower_id: 'g1' }, size: '35.70' },
    ]);
    expect(summary.get('g1')).toEqual({ count: 2, dunam: 35.7 });
  });

  it('skips plots with no grower', () => {
    const summary = summarisePlotsByGrower([
      { details: { grower_id: null }, size: '10' },
      { details: null, size: '10' },
      {},
    ]);
    expect(summary.size).toBe(0);
  });
});

describe('buildGrowerWrite', () => {
  it('copies only the keys present in the body', () => {
    expect(buildGrowerWrite({ city: 'קצרין' })).toEqual({ city: 'קצרין' });
  });

  it('never copies id, customer_id or created_at', () => {
    const patch = buildGrowerWrite({
      id: 'x',
      customer_id: 'other-tenant',
      created_at: '2020-01-01',
      city: 'קצרין',
    });
    expect(patch).toEqual({ city: 'קצרין' });
  });

  it('blanks empty text to null', () => {
    expect(buildGrowerWrite({ contact_phone: '   ' })).toEqual({ contact_phone: null });
  });

  it('nulls an invalid grower_type rather than passing it to the CHECK', () => {
    expect(buildGrowerWrite({ grower_type: 'bogus' })).toEqual({ grower_type: null });
    expect(buildGrowerWrite({ grower_type: PlotType.PARTNER })).toEqual({
      grower_type: PlotType.PARTNER,
    });
  });

  it('treats any non-false is_active as true', () => {
    expect(buildGrowerWrite({ is_active: false })).toEqual({ is_active: false });
    expect(buildGrowerWrite({ is_active: true })).toEqual({ is_active: true });
  });
});

describe('isGrowerType', () => {
  it('accepts the three codes and rejects anything else', () => {
    expect(isGrowerType(PlotType.OWNER)).toBe(true);
    expect(isGrowerType(PlotType.OCCASIONAL)).toBe(true);
    expect(isGrowerType('internal')).toBe(false);
    expect(isGrowerType(null)).toBe(false);
  });
});

/**
 * Aliases.
 *
 * The rules here are not cosmetic: an alias is the key the import resolver
 * looks a grower name up by (20260923120000), so a stray space or a duplicate
 * is the difference between a merge that survives the next backup and one that
 * silently comes apart. The cross-row rules — an alias that is another grower's
 * name, or one already taken — can only be answered against the database and
 * live in the route.
 */
describe('normaliseAliases', () => {
  it('trims, drops blanks and collapses duplicates keeping first position', () => {
    expect(normaliseAliases([' קיבוץ גשור דרום ', '', '  ', 'קיבוץ גשור דרום', 'אחר'])).toEqual([
      'קיבוץ גשור דרום',
      'אחר',
    ]);
  });

  it('ignores entries that are not strings rather than coercing them', () => {
    expect(normaliseAliases(['שם', 42, null, undefined, {}, ['x']])).toEqual(['שם']);
  });

  it('does not fold case — Hebrew has none, and folding would merge two Latin names', () => {
    expect(normaliseAliases(['Gashur', 'gashur'])).toEqual(['Gashur', 'gashur']);
  });

  it('answers [] for anything that is not an array, so an absent field is not a throw', () => {
    expect(normaliseAliases(undefined)).toEqual([]);
    expect(normaliseAliases(null)).toEqual([]);
    expect(normaliseAliases('קיבוץ גשור')).toEqual([]);
  });
});

describe('diffAliases', () => {
  it('reports only what actually changed', () => {
    expect(diffAliases(['א', 'ב'], ['ב', 'ג'])).toEqual({ added: ['ג'], removed: ['א'] });
  });

  it('is empty when the set is unchanged, whatever the order', () => {
    expect(diffAliases(['א', 'ב'], ['ב', 'א'])).toEqual({ added: [], removed: [] });
  });

  it('handles the two ends: nothing before, and nothing after', () => {
    expect(diffAliases([], ['א'])).toEqual({ added: ['א'], removed: [] });
    expect(diffAliases(['א'], [])).toEqual({ added: [], removed: ['א'] });
  });
});

describe('toGrowerRow aliases', () => {
  it('carries the list through', () => {
    const r = toGrowerRow(apiGrower({ aliases: ['קיבוץ גשור דרום', 'קיבוץ גשור מנחת צפון'] }));
    expect(r.aliases).toEqual(['קיבוץ גשור דרום', 'קיבוץ גשור מנחת צפון']);
  });

  it('is [] when the field is absent, so the grid never reads undefined.length', () => {
    expect(toGrowerRow(apiGrower()).aliases).toEqual([]);
  });

  it('drops non-strings rather than rendering them', () => {
    expect(toGrowerRow(apiGrower({ aliases: ['שם', 7, null] })).aliases).toEqual(['שם']);
  });
});

describe('filterGrowerRows over aliases', () => {
  /**
   * The point of the whole feature from the list's side: after merging
   * "קיבוץ גשור דרום" away, searching for it must still find the grower that
   * took its plots — otherwise the operator concludes the data was lost.
   */
  it('finds a grower by a name it absorbed', () => {
    const rows = [
      row({ id: 'a', name: 'קיבוץ גשור', aliases: ['קיבוץ גשור דרום'] }),
      row({ id: 'b', name: 'זית בבית - אלעד' }),
    ];
    const found = filterGrowerRows(rows, { ...EMPTY_GROWER_FILTERS, search: 'גשור דרום' });
    expect(found.map((r) => r.id)).toEqual(['a']);
  });

  it('still excludes a grower that matches on neither', () => {
    const rows = [row({ id: 'a', name: 'קיבוץ גשור', aliases: ['קיבוץ גשור דרום'] })];
    expect(filterGrowerRows(rows, { ...EMPTY_GROWER_FILTERS, search: 'מנדי' })).toEqual([]);
  });
});
