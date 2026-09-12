import { describe, it, expect, beforeEach } from 'vitest';
import {
  getAccessibleAreaIds,
  getCustomerAreaIds,
  getAllAreaIds,
} from '@/lib/services/customer-area.service';
import { createMockSupabase } from '../helpers/mock-supabase';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Area scoping. One function decides what nine API routes are allowed to see,
 * so the branch order here is the difference between an admin seeing one
 * tenant and seeing all of them.
 */

const CUSTOMER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CUSTOMER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

let supabase: ReturnType<typeof createMockSupabase>;

beforeEach(() => {
  supabase = createMockSupabase({
    areas: [{ id: 'area-a1' }, { id: 'area-a2' }, { id: 'area-b1' }, { id: 'area-orphan' }],
    customer_areas: [
      { customer_id: CUSTOMER_A, area_id: 'area-a1' },
      { customer_id: CUSTOMER_A, area_id: 'area-a2' },
      { customer_id: CUSTOMER_B, area_id: 'area-b1' },
    ],
  });
});

describe('getCustomerAreaIds', () => {
  it("returns only that customer's areas", async () => {
    expect(await getCustomerAreaIds(supabase as unknown as SupabaseClient, CUSTOMER_A)).toEqual([
      'area-a1',
      'area-a2',
    ]);
    expect(await getCustomerAreaIds(supabase as unknown as SupabaseClient, CUSTOMER_B)).toEqual([
      'area-b1',
    ]);
  });

  it('returns empty for a customer with no areas', async () => {
    expect(
      await getCustomerAreaIds(
        supabase as unknown as SupabaseClient,
        'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
      )
    ).toEqual([]);
  });
});

describe('getAllAreaIds', () => {
  it('includes areas linked to no customer', async () => {
    // An orphaned area is invisible to every tenant but still exists; the
    // import runbook has a query for exactly this case.
    expect(await getAllAreaIds(supabase as unknown as SupabaseClient)).toContain('area-orphan');
  });
});

describe('getAccessibleAreaIds', () => {
  it('scopes a non-admin to their customer', async () => {
    expect(
      await getAccessibleAreaIds(supabase as unknown as SupabaseClient, false, CUSTOMER_A)
    ).toEqual(['area-a1', 'area-a2']);
  });

  it('gives a non-admin with no customer nothing', async () => {
    expect(await getAccessibleAreaIds(supabase as unknown as SupabaseClient, false, null)).toEqual(
      []
    );
  });

  it('SCOPES AN ADMIN TO THE GIVEN CUSTOMER — the branch order that was wrong', async () => {
    // This is the whole bug. The old implementation checked isAdmin first and
    // returned every area, so an admin passing ?customerId= was silently
    // ignored. If this test fails, the branches have been reordered back.
    const ids = await getAccessibleAreaIds(supabase as unknown as SupabaseClient, true, CUSTOMER_A);

    expect(ids).toEqual(['area-a1', 'area-a2']);
    expect(ids).not.toContain('area-b1');
    expect(ids).not.toContain('area-orphan');
  });

  it('falls back to every area for an admin with no customer selected', async () => {
    // Phase 5 of the tenant switcher changes this to [] so an admin sees
    // nothing until they choose. Until then this preserves current behaviour,
    // which is what lets the switcher ship without changing what anyone sees.
    const ids = await getAccessibleAreaIds(supabase as unknown as SupabaseClient, true, null);

    expect(ids).toHaveLength(4);
    expect(ids).toContain('area-orphan');
  });

  it('never leaks another tenant when a customer is given', async () => {
    for (const isAdmin of [true, false]) {
      const ids = await getAccessibleAreaIds(
        supabase as unknown as SupabaseClient,
        isAdmin,
        CUSTOMER_B
      );
      expect(ids).toEqual(['area-b1']);
    }
  });
});
