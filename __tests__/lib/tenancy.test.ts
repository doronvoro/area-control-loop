import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { scopedAreaIds } from '@/lib/api/tenancy';
import type { ApiContext } from '@/lib/api/auth-context';
import { createMockSupabase } from '../helpers/mock-supabase';

/**
 * scopedAreaIds returns null and [] to mean opposite things, and confusing them
 * inverts tenant isolation: null means "show everything", [] means "show
 * nothing". Every case is pinned here because the difference is invisible at
 * the call site if a route branches on truthiness.
 */

const CUSTOMER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CUSTOMER_EMPTY = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

const supabase = createMockSupabase({
  customer_areas: [
    { customer_id: CUSTOMER_A, area_id: 'area-a1' },
    { customer_id: CUSTOMER_A, area_id: 'area-a2' },
  ],
}) as unknown as SupabaseClient;

function ctx(overrides: Partial<ApiContext>): ApiContext {
  return {
    supabase,
    adminClient: supabase,
    user: { id: 'user-1' },
    worker: null,
    customer: null,
    isAdmin: false,
    scopedCustomerId: null,
    ...overrides,
  } as ApiContext;
}

describe('scopedAreaIds', () => {
  it('returns null for an admin with no selection — no filter, sees every tenant', async () => {
    // Phase 5 changes this to []. Until then, returning [] here would blank
    // every admin screen in the app at once.
    const result = await scopedAreaIds(ctx({ isAdmin: true }));
    expect(result).toBeNull();
  });

  it("returns an admin's selected customer areas", async () => {
    const result = await scopedAreaIds(ctx({ isAdmin: true, scopedCustomerId: CUSTOMER_A }));
    expect(result).toEqual(['area-a1', 'area-a2']);
  });

  it('honours an explicit override for an admin', async () => {
    const result = await scopedAreaIds(ctx({ isAdmin: true }), CUSTOMER_A);
    expect(result).toEqual(['area-a1', 'area-a2']);
  });

  it('ignores an override from a non-admin', async () => {
    // The forged-parameter case. A non-admin passing another tenant's id gets
    // their own scope — here, none at all.
    const result = await scopedAreaIds(ctx({ isAdmin: false }), CUSTOMER_A);
    expect(result).toEqual([]);
  });

  it('returns [] — not null — for a user with no tenancy', async () => {
    // The dangerous inversion: null here would show a self-registered user
    // with no customer and no worker row every tenant's data.
    const result = await scopedAreaIds(ctx({ isAdmin: false }));
    expect(result).toEqual([]);
    expect(result).not.toBeNull();
  });

  it('returns [] for a customer that has no areas yet', async () => {
    // A freshly created tenant. Must produce an empty response, not an
    // unfiltered one.
    const result = await scopedAreaIds(ctx({ scopedCustomerId: CUSTOMER_EMPTY }));
    expect(result).toEqual([]);
  });

  it("scopes a customer owner to their own customer's areas", async () => {
    const result = await scopedAreaIds(
      ctx({ customer: { id: CUSTOMER_A }, scopedCustomerId: CUSTOMER_A })
    );
    expect(result).toEqual(['area-a1', 'area-a2']);
  });

  it('distinguishes null from [] in a way truthiness would not', async () => {
    // Documents why callers must test `=== null`: both values are falsy in no
    // useful sense, and `if (areaIds)` is true for [] — which would apply an
    // empty IN filter, while `if (!areaIds)` is false for [] — which would skip
    // filtering entirely. Either mistake is a tenant leak or a blank screen.
    const adminNoSelection = await scopedAreaIds(ctx({ isAdmin: true }));
    const noTenancy = await scopedAreaIds(ctx({ isAdmin: false }));

    expect(adminNoSelection).toBeNull();
    expect(noTenancy).toEqual([]);
    expect(Boolean(adminNoSelection)).toBe(false);
    expect(Boolean(noTenancy)).toBe(true);
  });
});
