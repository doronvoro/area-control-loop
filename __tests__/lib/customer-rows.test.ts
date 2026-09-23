import { describe, it, expect } from 'vitest';
import {
  toCustomerRow,
  filterCustomerRows,
  sortCustomerRows,
  hasActiveCustomerFilters,
  EMPTY_CUSTOMER_FILTERS,
  UNCLASSIFIED_LABEL,
  type CustomerRow,
  type CustomerSortField,
} from '@/lib/customers/customer-rows';
import { CUSTOMER_TYPE_LABELS, CustomerType } from '@/types/database';

/**
 * The customers grid's row model.
 *
 * Two coercions carry real weight here. `is_active` must read as TRUE for a
 * payload that predates the column, or every existing tenant disappears behind
 * the default filter; and an unclassified `customer_type` must stay findable
 * rather than rendering as an empty cell.
 */

function apiCustomer(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'c-1',
    user_id: 'u-1',
    name: 'ארץ גשור',
    description: 'מגדל זיתים',
    customer_type: CustomerType.OWNER,
    contact_person: 'דני כהן',
    contact_phone: '04-6961234',
    contact_mobile: '050-1234567',
    contact_email: 'office@example.com',
    login_email: 'login@example.com',
    address: 'רחוב הזיתים 1',
    city: 'קצרין',
    business_id: '512345678',
    notes: 'שילם מראש',
    is_active: true,
    created_at: '2026-03-01T08:00:00Z',
    updated_at: '2026-03-01T08:00:00Z',
    ...overrides,
  };
}

function row(overrides: Partial<CustomerRow> = {}): CustomerRow {
  return {
    id: 'c-x',
    userId: 'u-x',
    name: 'לקוח',
    customerType: null,
    customerTypeLabel: UNCLASSIFIED_LABEL,
    contactPerson: null,
    contactPhone: null,
    contactMobile: null,
    contactEmail: null,
    loginEmail: null,
    address: null,
    city: null,
    businessId: null,
    description: null,
    notes: null,
    isActive: true,
    createdAt: null,
    createdAtLabel: '—',
    ...overrides,
  };
}

/**
 * A row carrying a type, with its label derived the way toCustomerRow derives
 * it. `row()` cannot do this itself — the label is an independent field, and
 * having the factory infer it would hide a mismatch between the two.
 */
function typedRow(type: CustomerType, overrides: Partial<CustomerRow> = {}): CustomerRow {
  return row({
    customerType: type,
    customerTypeLabel: CUSTOMER_TYPE_LABELS[type],
    ...overrides,
  });
}

function sortBy(rows: CustomerRow[], field: CustomerSortField, direction: 'asc' | 'desc') {
  return sortCustomerRows(rows, { field, direction });
}

describe('toCustomerRow', () => {
  it('flattens every field', () => {
    const r = toCustomerRow(apiCustomer());

    expect(r.id).toBe('c-1');
    expect(r.userId).toBe('u-1');
    expect(r.name).toBe('ארץ גשור');
    expect(r.contactPerson).toBe('דני כהן');
    expect(r.businessId).toBe('512345678');
    expect(r.city).toBe('קצרין');
  });

  it('labels a known type in Hebrew', () => {
    expect(toCustomerRow(apiCustomer()).customerTypeLabel).toBe('ארץ גשור');
    expect(
      toCustomerRow(apiCustomer({ customer_type: CustomerType.PARTNER })).customerTypeLabel
    ).toBe('שותף');
    expect(
      toCustomerRow(apiCustomer({ customer_type: CustomerType.INTERNAL })).customerTypeLabel
    ).toBe('פנימי');
  });

  it('falls back to the raw code for a type it does not know', () => {
    const r = toCustomerRow(apiCustomer({ customer_type: 'franchise' }));
    expect(r.customerType).toBe('franchise');
    expect(r.customerTypeLabel).toBe('franchise');
  });

  it('labels a null type as unclassified', () => {
    const r = toCustomerRow(apiCustomer({ customer_type: null }));
    expect(r.customerType).toBeNull();
    expect(r.customerTypeLabel).toBe(UNCLASSIFIED_LABEL);
  });

  it('keeps the login email separate from the contact email', () => {
    const r = toCustomerRow(apiCustomer());
    expect(r.contactEmail).toBe('office@example.com');
    expect(r.loginEmail).toBe('login@example.com');
  });

  it('reads a row with no is_active as active', () => {
    // A payload from before the column existed. Reading it as inactive would
    // hide every existing tenant behind the default filter.
    const { is_active: _omitted, ...withoutFlag } = apiCustomer();
    expect(toCustomerRow(withoutFlag).isActive).toBe(true);
  });

  it('reads an explicit false as inactive', () => {
    expect(toCustomerRow(apiCustomer({ is_active: false })).isActive).toBe(false);
  });

  it('treats blank text as null', () => {
    const r = toCustomerRow(apiCustomer({ city: '   ', notes: '' }));
    expect(r.city).toBeNull();
    expect(r.notes).toBeNull();
  });

  it('formats created_at as a he-IL date, and — when absent', () => {
    expect(toCustomerRow(apiCustomer()).createdAtLabel).toBe(
      new Date('2026-03-01T08:00:00Z').toLocaleDateString('he-IL')
    );
    expect(toCustomerRow(apiCustomer({ created_at: null })).createdAtLabel).toBe('—');
  });
});

describe('filterCustomerRows', () => {
  const rows = [
    typedRow(CustomerType.OWNER, { id: 'a', name: 'ארץ גשור', city: 'קצרין' }),
    typedRow(CustomerType.PARTNER, {
      id: 'b',
      name: 'מטעי הגולן',
      contactPerson: 'רונית',
      isActive: false,
    }),
    row({ id: 'c', name: 'חלקה פנימית', customerType: null }),
  ];

  it('returns everything with no filters', () => {
    expect(filterCustomerRows(rows, EMPTY_CUSTOMER_FILTERS)).toHaveLength(3);
  });

  it('filters by type', () => {
    const out = filterCustomerRows(rows, {
      ...EMPTY_CUSTOMER_FILTERS,
      customerType: CustomerType.PARTNER,
    });
    expect(out.map((r) => r.id)).toEqual(['b']);
  });

  it("matches only unclassified rows for 'none'", () => {
    const out = filterCustomerRows(rows, { ...EMPTY_CUSTOMER_FILTERS, customerType: 'none' });
    expect(out.map((r) => r.id)).toEqual(['c']);
  });

  it('filters by status in both directions', () => {
    expect(
      filterCustomerRows(rows, { ...EMPTY_CUSTOMER_FILTERS, status: 'inactive' }).map((r) => r.id)
    ).toEqual(['b']);
    expect(
      filterCustomerRows(rows, { ...EMPTY_CUSTOMER_FILTERS, status: 'active' }).map((r) => r.id)
    ).toEqual(['a', 'c']);
  });

  it.each([
    ['name', 'גולן', 'b'],
    ['contact person', 'רונית', 'b'],
    ['city', 'קצרין', 'a'],
    ['type label', 'שותף', 'b'],
  ])('searches %s', (_label, term, expected) => {
    const out = filterCustomerRows(rows, { ...EMPTY_CUSTOMER_FILTERS, search: term });
    expect(out.map((r) => r.id)).toEqual([expected]);
  });

  it.each([
    ['contactPhone', '04-6961234'],
    ['contactMobile', '050-7654321'],
    ['contactEmail', 'office@example.com'],
    ['loginEmail', 'login@example.com'],
    ['businessId', '512345678'],
    ['address', 'רחוב הזיתים'],
    ['notes', 'שילם מראש'],
    ['description', 'מגדל זיתים'],
  ] as const)('searches %s', (field, term) => {
    const target = row({ id: 'target', [field]: term } as Partial<CustomerRow>);
    const out = filterCustomerRows([...rows, target], {
      ...EMPTY_CUSTOMER_FILTERS,
      search: term,
    });
    expect(out.map((r) => r.id)).toContain('target');
  });

  it('searches case-insensitively', () => {
    const target = row({ id: 'target', contactEmail: 'Office@Example.com' });
    const out = filterCustomerRows([target], {
      ...EMPTY_CUSTOMER_FILTERS,
      search: 'office@example',
    });
    expect(out).toHaveLength(1);
  });

  it('combines filters', () => {
    const out = filterCustomerRows(rows, {
      search: 'גולן',
      customerType: CustomerType.OWNER,
      status: 'all',
    });
    expect(out).toHaveLength(0);
  });
});

describe('sortCustomerRows', () => {
  it('sorts names with Hebrew collation', () => {
    const rows = [row({ name: 'תמר' }), row({ name: 'אבו' }), row({ name: 'מיצר' })];
    expect(sortBy(rows, 'name', 'asc').map((r) => r.name)).toEqual(['אבו', 'מיצר', 'תמר']);
    expect(sortBy(rows, 'name', 'desc').map((r) => r.name)).toEqual(['תמר', 'מיצר', 'אבו']);
  });

  it('sorts the type column in business order, not alphabetically', () => {
    // owner → partner → internal, as CUSTOMER_TYPE_OPTIONS lists them. An
    // alphabetical sort of the Hebrew labels would give פנימי before שותף.
    const rows = [
      row({ id: 'i', customerType: CustomerType.INTERNAL }),
      row({ id: 'o', customerType: CustomerType.OWNER }),
      row({ id: 'p', customerType: CustomerType.PARTNER }),
    ];
    expect(sortBy(rows, 'customerType', 'asc').map((r) => r.id)).toEqual(['o', 'p', 'i']);
  });

  it.each(['asc', 'desc'] as const)('puts nulls last on %s', (direction) => {
    const rows = [
      row({ id: 'none', city: null }),
      row({ id: 'a', city: 'אלון' }),
      row({ id: 'z', city: 'קצרין' }),
    ];
    expect(sortBy(rows, 'city', direction).at(-1)?.id).toBe('none');
  });

  it('puts an unclassified type last in both directions', () => {
    const rows = [
      row({ id: 'none', customerType: null }),
      row({ id: 'o', customerType: CustomerType.OWNER }),
    ];
    expect(sortBy(rows, 'customerType', 'asc').at(-1)?.id).toBe('none');
    expect(sortBy(rows, 'customerType', 'desc').at(-1)?.id).toBe('none');
  });

  it('groups by status', () => {
    const rows = [
      row({ id: 'on', isActive: true }),
      row({ id: 'off', isActive: false }),
      row({ id: 'on2', isActive: true }),
    ];
    expect(sortBy(rows, 'isActive', 'asc').map((r) => r.id)).toEqual(['off', 'on', 'on2']);
  });

  it('sorts by created date, nulls last', () => {
    const rows = [
      row({ id: 'new', createdAt: '2026-05-01T00:00:00Z' }),
      row({ id: 'none', createdAt: null }),
      row({ id: 'old', createdAt: '2026-01-01T00:00:00Z' }),
    ];
    expect(sortBy(rows, 'createdAt', 'desc').map((r) => r.id)).toEqual(['new', 'old', 'none']);
  });

  it('breaks ties by name', () => {
    const rows = [
      row({ name: 'תמר', isActive: true }),
      row({ name: 'אבו', isActive: true }),
    ];
    expect(sortBy(rows, 'isActive', 'desc').map((r) => r.name)).toEqual(['אבו', 'תמר']);
  });

  it('does not mutate its input', () => {
    const rows = [row({ name: 'תמר' }), row({ name: 'אבו' })];
    sortBy(rows, 'name', 'asc');
    expect(rows.map((r) => r.name)).toEqual(['תמר', 'אבו']);
  });
});

describe('hasActiveCustomerFilters', () => {
  it('is false for the empty filters', () => {
    expect(hasActiveCustomerFilters(EMPTY_CUSTOMER_FILTERS)).toBe(false);
  });

  it('ignores a whitespace-only search', () => {
    expect(hasActiveCustomerFilters({ ...EMPTY_CUSTOMER_FILTERS, search: '   ' })).toBe(false);
  });

  it.each([
    ['search', { search: 'גשור' }],
    ['type', { customerType: CustomerType.OWNER as string }],
    ['status', { status: 'inactive' }],
  ])('is true for an active %s filter', (_label, patch) => {
    expect(hasActiveCustomerFilters({ ...EMPTY_CUSTOMER_FILTERS, ...patch })).toBe(true);
  });
});
