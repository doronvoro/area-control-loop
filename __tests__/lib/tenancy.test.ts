import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { scopedAreaIds, assertCustomerInScope } from '@/lib/api/tenancy';
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
  it('returns [] for an admin with no selection — scoped to nothing', async () => {
    // Not null. An admin who has not chosen a customer sees nothing and is
    // prompted to choose; returning null here would restore the merged
    // all-tenants view the switcher exists to replace.
    const result = await scopedAreaIds(ctx({ isAdmin: true }));
    expect(result).toEqual([]);
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

  it('never returns null today — every caller is scoped to something', async () => {
    // null still means "no filter" and callers must keep branching on
    // `=== null`, but nothing produces it now. If a future caller does, this
    // test failing is the reminder to check every `areaIds !== null` site
    // rather than assume the array form.
    for (const c of [
      ctx({ isAdmin: true }),
      ctx({ isAdmin: false }),
      ctx({ isAdmin: true, scopedCustomerId: CUSTOMER_A }),
      ctx({ scopedCustomerId: CUSTOMER_EMPTY }),
    ]) {
      expect(await scopedAreaIds(c)).not.toBeNull();
    }
  });
});

describe('assertCustomerInScope', () => {
  const CUSTOMER_OTHER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

  it('allows a customer owner to act on their own customer', async () => {
    await expect(
      assertCustomerInScope(ctx({ customer: { id: CUSTOMER_A }, scopedCustomerId: CUSTOMER_A }), CUSTOMER_A)
    ).resolves.toBeUndefined();
  });

  it('refuses a customer owner acting on another tenant', async () => {
    // The hole this closes: worker POST took customer_id from the request body
    // and DELETE ran on adminClient, so an owner could create staff inside — or
    // delete staff from — a tenant that was not theirs.
    await expect(
      assertCustomerInScope(
        ctx({ customer: { id: CUSTOMER_A }, scopedCustomerId: CUSTOMER_A }),
        CUSTOMER_OTHER
      )
    ).rejects.toMatchObject({ status: 403 });
  });

  it('allows an admin acting on the customer they have selected', async () => {
    await expect(
      assertCustomerInScope(ctx({ isAdmin: true, scopedCustomerId: CUSTOMER_A }), CUSTOMER_A)
    ).resolves.toBeUndefined();
  });

  it('refuses an admin acting on a tenant they have not selected', async () => {
    await expect(
      assertCustomerInScope(ctx({ isAdmin: true, scopedCustomerId: CUSTOMER_A }), CUSTOMER_OTHER)
    ).rejects.toMatchObject({ status: 403 });
  });

  it('refuses an admin who has selected nothing', async () => {
    // Deliberately not "admins may do anything". Writing into a tenant you have
    // not explicitly chosen is the accident the switcher exists to prevent.
    await expect(
      assertCustomerInScope(ctx({ isAdmin: true }), CUSTOMER_A)
    ).rejects.toMatchObject({ status: 403 });
  });

  it('refuses a user with no tenancy at all', async () => {
    await expect(
      assertCustomerInScope(ctx({ isAdmin: false }), CUSTOMER_A)
    ).rejects.toMatchObject({ status: 403 });
  });
});
