/**
 * The growers grid's row model, and the pure filter/sort over it.
 *
 * Same boundary and the same reasons as lib/customers/customer-rows.ts, with one
 * addition that matters: `plotCount` and `totalDunam` are roll-ups the API
 * computes, and `totalDunam` arrives from a NUMERIC sum, so it is coerced here
 * rather than trusted.
 *
 * Everything here is pure.
 */

import { PLOT_TYPE_LABELS, type PlotType } from '@/types/database';
import type { SortState } from '@/components/ui/sortable-table-head';

/** A grower flattened for display. */
export interface GrowerRow {
  id: string;
  name: string;
  /** PlotType code, or null when unclassified. */
  growerType: string | null;
  /** PLOT_TYPE_LABELS where known, the raw code if not, 'לא סווג' when null. */
  growerTypeLabel: string;
  /**
   * Other spellings this grower was merged from. Searchable, so looking up an
   * absorbed name still finds the grower that now holds its plots.
   */
  aliases: string[];
  contactPerson: string | null;
  contactPhone: string | null;
  contactMobile: string | null;
  contactEmail: string | null;
  address: string | null;
  city: string | null;
  businessId: string | null;
  notes: string | null;
  isActive: boolean;
  /** Olive plots of the asking tenant that point at this grower. */
  plotCount: number;
  /** Their combined size in dunam. */
  totalDunam: number;
  createdAt: string | null;
  createdAtLabel: string;
}

export type GrowerSortField =
  | 'name'
  | 'growerType'
  | 'contactPerson'
  | 'city'
  | 'plotCount'
  | 'totalDunam'
  | 'isActive';

export interface GrowerFilters {
  search: string;
  /** 'all' | a PlotType value | 'none' (unclassified). */
  growerType: string;
  /** 'all' | 'active' | 'inactive'. */
  status: string;
  /** 'all' | 'with' (has plots) | 'without'. */
  plots: string;
}

export const EMPTY_GROWER_FILTERS: GrowerFilters = {
  search: '',
  growerType: 'all',
  status: 'all',
  plots: 'all',
};

export function hasActiveGrowerFilters(f: GrowerFilters): boolean {
  return (
    f.search.trim() !== '' || f.growerType !== 'all' || f.status !== 'all' || f.plots !== 'all'
  );
}

/** The label shown for an unclassified grower, in the grid and in the filter. */
export const UNCLASSIFIED_LABEL = 'לא סווג';

export function toGrowerRow(record: Record<string, unknown>): GrowerRow {
  const growerType = (record.grower_type as string | null) ?? null;
  const createdAt = (record.created_at as string | null) ?? null;

  return {
    id: record.id as string,
    name: (record.name as string | null) ?? '',
    growerType,
    growerTypeLabel: growerType
      ? (PLOT_TYPE_LABELS[growerType as PlotType] ?? growerType)
      : UNCLASSIFIED_LABEL,
    aliases: Array.isArray(record.aliases)
      ? (record.aliases as unknown[]).filter((a): a is string => typeof a === 'string')
      : [],
    contactPerson: text(record.contact_person),
    contactPhone: text(record.contact_phone),
    contactMobile: text(record.contact_mobile),
    contactEmail: text(record.contact_email),
    address: text(record.address),
    city: text(record.city),
    businessId: text(record.business_id),
    notes: text(record.notes),
    isActive: record.is_active !== false,
    plotCount: numeric(record.plot_count),
    totalDunam: numeric(record.total_dunam),
    createdAt,
    createdAtLabel: createdAt ? new Date(createdAt).toLocaleDateString('he-IL') : '—',
  };
}

export function filterGrowerRows(rows: GrowerRow[], filters: GrowerFilters): GrowerRow[] {
  const term = filters.search.trim().toLowerCase();

  return rows.filter((row) => {
    if (filters.growerType !== 'all') {
      if (
        filters.growerType === 'none'
          ? row.growerType !== null
          : row.growerType !== filters.growerType
      )
        return false;
    }

    if (filters.status !== 'all' && row.isActive !== (filters.status === 'active')) return false;

    if (filters.plots !== 'all' && row.plotCount > 0 !== (filters.plots === 'with')) return false;

    if (term) {
      const haystack = [
        row.name,
        ...row.aliases,
        row.growerTypeLabel,
        row.contactPerson,
        row.contactPhone,
        row.contactMobile,
        row.contactEmail,
        row.businessId,
        row.address,
        row.city,
        row.notes,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(term)) return false;
    }

    return true;
  });
}

export function sortGrowerRows(rows: GrowerRow[], sort: SortState<GrowerSortField>): GrowerRow[] {
  const factor = sort.direction === 'asc' ? 1 : -1;

  return [...rows].sort((a, b) => {
    const compared = compare(a, b, sort.field);
    // A null is "no data", not a small value, so it sorts last in BOTH
    // directions rather than flipping to the top on desc.
    if (compared === null) return 0;
    if (compared === 'a-null') return 1;
    if (compared === 'b-null') return -1;
    // Name is the stable tiebreak — the column the grid opens on, and the only
    // field guaranteed to be present.
    if (compared === 0) return a.name.localeCompare(b.name, 'he');
    return compared * factor;
  });
}

// --- Private helpers ---

type Comparison = number | 'a-null' | 'b-null' | null;

/**
 * Business order for the type column, not alphabetical — the same reason
 * CATEGORY_ORDER exists in lib/olive/plot-rows.ts. Built from PLOT_TYPE_LABELS'
 * own key order so a fourth type orders itself.
 */
const GROWER_TYPE_ORDER = new Map<string, number>(
  Object.keys(PLOT_TYPE_LABELS).map((code, index) => [code, index])
);

function compare(a: GrowerRow, b: GrowerRow, field: GrowerSortField): Comparison {
  if (field === 'name') {
    // Hebrew collation — a plain < would order by code point.
    return a.name.localeCompare(b.name, 'he');
  }

  if (field === 'growerType') {
    return nullsLast(
      a.growerType,
      b.growerType,
      (x, y) => (GROWER_TYPE_ORDER.get(x) ?? 0) - (GROWER_TYPE_ORDER.get(y) ?? 0)
    );
  }

  if (field === 'isActive') return Number(a.isActive) - Number(b.isActive);
  // Counts are never null — a grower with no plots is 0, which is data.
  if (field === 'plotCount') return a.plotCount - b.plotCount;
  if (field === 'totalDunam') return a.totalDunam - b.totalDunam;

  return nullsLast(a[field], b[field], (x, y) => x.localeCompare(y, 'he'));
}

function nullsLast<T>(a: T | null, b: T | null, cmp: (x: T, y: T) => number): Comparison {
  if (a === null && b === null) return null;
  if (a === null) return 'a-null';
  if (b === null) return 'b-null';
  return cmp(a, b);
}

/** '' and whitespace mean "not filled in", the same as null. */
function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/** NUMERIC over PostgREST is a string; a bad value is 0, not NaN in a cell. */
function numeric(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
