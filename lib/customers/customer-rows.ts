/**
 * The customers grid's row model, and the pure filter/sort over it.
 *
 * Same boundary, and the same reasons, as lib/olive/harvest-rows.ts: the view
 * model is flattened and fully coerced once, so the table, the toolbar and the
 * drawer all read the same shape and nothing downstream has to know what
 * PostgREST returned.
 *
 * Two fields are not `customers` columns and are worth naming as such:
 * `loginEmail` comes from auth.users via /api/customers' GET, and
 * `customerTypeLabel` is the Hebrew rendering of an English code.
 *
 * There is deliberately no `raw` escape hatch (HarvestRow has one): every field
 * the drawer needs is on the row, so the drawer takes the typed row and there is
 * no untyped copy to keep in sync.
 *
 * Everything here is pure.
 */

import { CUSTOMER_TYPE_LABELS, CUSTOMER_TYPE_OPTIONS, type CustomerType } from '@/types/database';
import type { SortState } from '@/components/ui/sortable-table-head';

/** A customer flattened for display. */
export interface CustomerRow {
  id: string;
  /** auth.users.id — RecoveryLinkDialog needs it. */
  userId: string;
  name: string;
  /** CustomerType code, or null on a row predating the column. */
  customerType: string | null;
  /** CUSTOMER_TYPE_LABELS where known, the raw code if not, 'לא סווג' when null. */
  customerTypeLabel: string;
  contactPerson: string | null;
  contactPhone: string | null;
  contactMobile: string | null;
  /** Correspondence address. NOT the login identity — see loginEmail. */
  contactEmail: string | null;
  /** auth.users email, the LOGIN identity. Not a customers column. */
  loginEmail: string | null;
  address: string | null;
  city: string | null;
  businessId: string | null;
  description: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string | null;
  /** he-IL calendar date, or '—'. */
  createdAtLabel: string;
}

export type CustomerSortField =
  | 'name'
  | 'customerType'
  | 'contactPerson'
  | 'city'
  | 'isActive'
  | 'createdAt';

export interface CustomerFilters {
  search: string;
  /** 'all' | a CustomerType value | 'none' (unclassified). */
  customerType: string;
  /** 'all' | 'active' | 'inactive'. */
  status: string;
}

export const EMPTY_CUSTOMER_FILTERS: CustomerFilters = {
  search: '',
  customerType: 'all',
  status: 'all',
};

export function hasActiveCustomerFilters(f: CustomerFilters): boolean {
  return f.search.trim() !== '' || f.customerType !== 'all' || f.status !== 'all';
}

/** The label shown for an unclassified row, in the grid and in the filter. */
export const UNCLASSIFIED_LABEL = 'לא סווג';

/** Flatten one API customer record. */
export function toCustomerRow(record: Record<string, unknown>): CustomerRow {
  const customerType = (record.customer_type as string | null) ?? null;
  const createdAt = (record.created_at as string | null) ?? null;

  return {
    id: record.id as string,
    userId: (record.user_id as string | null) ?? '',
    name: (record.name as string | null) ?? '',
    customerType,
    customerTypeLabel: customerType
      ? (CUSTOMER_TYPE_LABELS[customerType as CustomerType] ?? customerType)
      : UNCLASSIFIED_LABEL,
    contactPerson: text(record.contact_person),
    contactPhone: text(record.contact_phone),
    contactMobile: text(record.contact_mobile),
    contactEmail: text(record.contact_email),
    loginEmail: text(record.login_email),
    address: text(record.address),
    city: text(record.city),
    businessId: text(record.business_id),
    description: text(record.description),
    notes: text(record.notes),
    // `!== false`, not `Boolean(...)`: a payload from before the column existed
    // has `is_active` undefined, and an existing tenant is in use. Reading it as
    // inactive would hide every row behind the default filter.
    isActive: record.is_active !== false,
    createdAt,
    createdAtLabel: createdAt ? new Date(createdAt).toLocaleDateString('he-IL') : '—',
  };
}

export function filterCustomerRows(
  rows: CustomerRow[],
  filters: CustomerFilters
): CustomerRow[] {
  const term = filters.search.trim().toLowerCase();

  return rows.filter((row) => {
    if (filters.customerType !== 'all') {
      if (
        filters.customerType === 'none'
          ? row.customerType !== null
          : row.customerType !== filters.customerType
      )
        return false;
    }

    if (filters.status !== 'all' && row.isActive !== (filters.status === 'active')) return false;

    if (term) {
      // loginEmail is in the haystack on purpose: an operator looking for a
      // tenant usually has the address they log in with, not the one on file
      // for correspondence.
      const haystack = [
        row.name,
        row.customerTypeLabel,
        row.contactPerson,
        row.contactPhone,
        row.contactMobile,
        row.contactEmail,
        row.loginEmail,
        row.businessId,
        row.address,
        row.city,
        row.description,
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

export function sortCustomerRows(
  rows: CustomerRow[],
  sort: SortState<CustomerSortField>
): CustomerRow[] {
  const factor = sort.direction === 'asc' ? 1 : -1;

  return [...rows].sort((a, b) => {
    const compared = compare(a, b, sort.field);
    // A null is "no data", not a small value, so it sorts last in BOTH
    // directions rather than flipping to the top on desc.
    if (compared === null) return 0;
    if (compared === 'a-null') return 1;
    if (compared === 'b-null') return -1;
    // Name is the stable tiebreak — it is the column the grid opens on and the
    // only field guaranteed to be present.
    if (compared === 0) return a.name.localeCompare(b.name, 'he');
    return compared * factor;
  });
}

// --- Private helpers ---

type Comparison = number | 'a-null' | 'b-null' | null;

/**
 * Business order for the type column, not alphabetical — the same reason
 * CATEGORY_ORDER exists in lib/olive/plot-rows.ts. Built from
 * CUSTOMER_TYPE_OPTIONS so adding a fourth type orders it without a second edit.
 */
const CUSTOMER_TYPE_ORDER = new Map<string, number>(
  CUSTOMER_TYPE_OPTIONS.map((option, index) => [option.value as string, index])
);

function compare(a: CustomerRow, b: CustomerRow, field: CustomerSortField): Comparison {
  if (field === 'name') {
    // Hebrew collation — a plain < would order by code point.
    return a.name.localeCompare(b.name, 'he');
  }

  if (field === 'customerType') {
    return nullsLast(
      a.customerType,
      b.customerType,
      (x, y) => (CUSTOMER_TYPE_ORDER.get(x) ?? 0) - (CUSTOMER_TYPE_ORDER.get(y) ?? 0)
    );
  }

  if (field === 'isActive') {
    return Number(a.isActive) - Number(b.isActive);
  }

  if (field === 'createdAt') {
    return nullsLast(a.createdAt, b.createdAt, (x, y) => x.localeCompare(y));
  }

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
