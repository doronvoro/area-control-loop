import { describe, it, expect } from 'vitest';
import {
  SELECTED_CUSTOMER_COOKIE,
  serializeSelectionCookie,
  parseSelectionCookie,
  resolveScopedCustomerId,
} from '@/lib/api/customer-selection';

/**
 * The admin customer switcher rests entirely on these three functions, and the
 * ways they can be wrong are all silent: the wrong tenant's data rendered under
 * the right tenant's name, or a selection that appears to do nothing.
 *
 * The two cases worth reading before changing anything here are "an admin who
 * also has a customers row" and "a non-admin sending a forged cookie".
 */

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';
const CUSTOMER_1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CUSTOMER_2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe('the cookie', () => {
  it('round-trips a selection for its owner', () => {
    const raw = serializeSelectionCookie(USER_A, CUSTOMER_1);
    expect(parseSelectionCookie(raw, USER_A)).toBe(CUSTOMER_1);
  });

  it('is ignored by a different user', () => {
    // Logout is client-side and cannot clear an httpOnly cookie, so admin B can
    // arrive at a browser still holding admin A's selection. Without this they
    // would silently inherit it.
    const raw = serializeSelectionCookie(USER_A, CUSTOMER_1);
    expect(parseSelectionCookie(raw, USER_B)).toBeNull();
  });

  it('rejects a customer id that is not a uuid', () => {
    expect(parseSelectionCookie(`${USER_A}:not-a-uuid`, USER_A)).toBeNull();
    expect(parseSelectionCookie(`${USER_A}:`, USER_A)).toBeNull();
    // A SQL-ish payload is rejected by shape, not by escaping.
    expect(parseSelectionCookie(`${USER_A}:' OR 1=1 --`, USER_A)).toBeNull();
  });

  it('rejects malformed and absent values without throwing', () => {
    expect(parseSelectionCookie(null, USER_A)).toBeNull();
    expect(parseSelectionCookie(undefined, USER_A)).toBeNull();
    expect(parseSelectionCookie('', USER_A)).toBeNull();
    expect(parseSelectionCookie('no-separator-here', USER_A)).toBeNull();
    expect(parseSelectionCookie(':', USER_A)).toBeNull();
    expect(parseSelectionCookie(CUSTOMER_1, USER_A)).toBeNull();
  });

  it('splits on the first separator only', () => {
    // Guards the encoding against a future third field silently breaking it.
    const raw = `${USER_A}:${CUSTOMER_1}:extra`;
    expect(parseSelectionCookie(raw, USER_A)).toBeNull();
  });

  it('accepts uppercase uuids', () => {
    const upper = CUSTOMER_1.toUpperCase();
    expect(parseSelectionCookie(`${USER_A}:${upper}`, USER_A)).toBe(upper);
  });

  it('has a name that will not collide with Supabase auth cookies', () => {
    expect(SELECTED_CUSTOMER_COOKIE).toBe('acl_selected_customer');
    expect(SELECTED_CUSTOMER_COOKIE.startsWith('sb-')).toBe(false);
  });
});

describe('resolveScopedCustomerId', () => {
  it('scopes an admin to their selection', () => {
    expect(
      resolveScopedCustomerId({
        isAdmin: true,
        cookieCustomerId: CUSTOMER_1,
        ownedCustomerId: null,
        workerCustomerId: null,
      })
    ).toBe(CUSTOMER_1);
  });

  it('gives an admin with no selection no scope', () => {
    expect(
      resolveScopedCustomerId({
        isAdmin: true,
        cookieCustomerId: null,
        ownedCustomerId: null,
        workerCustomerId: null,
      })
    ).toBeNull();
  });

  it("lets an admin's selection beat a customers row they happen to own", () => {
    // The load-bearing case. The old create-admin script gave every admin a
    // customers row linked to every area, and those accounts still exist. A
    // plain `cookie || owned || worker` chain is correct here by luck, but the
    // reverse — falling back to the legacy row — would make the switcher look
    // broken while silently showing all tenants.
    expect(
      resolveScopedCustomerId({
        isAdmin: true,
        cookieCustomerId: CUSTOMER_1,
        ownedCustomerId: CUSTOMER_2,
        workerCustomerId: null,
      })
    ).toBe(CUSTOMER_1);
  });

  it('does NOT fall back to a legacy customers row when an admin has no selection', () => {
    // Falling back here would mean an admin silently scoped to the "owns
    // everything" row, i.e. the switcher having no effect at all.
    expect(
      resolveScopedCustomerId({
        isAdmin: true,
        cookieCustomerId: null,
        ownedCustomerId: CUSTOMER_2,
        workerCustomerId: CUSTOMER_2,
      })
    ).toBeNull();
  });

  it('scopes a customer owner to their own customer', () => {
    expect(
      resolveScopedCustomerId({
        isAdmin: false,
        cookieCustomerId: null,
        ownedCustomerId: CUSTOMER_1,
        workerCustomerId: null,
      })
    ).toBe(CUSTOMER_1);
  });

  it('scopes a worker to their employer', () => {
    expect(
      resolveScopedCustomerId({
        isAdmin: false,
        cookieCustomerId: null,
        ownedCustomerId: null,
        workerCustomerId: CUSTOMER_2,
      })
    ).toBe(CUSTOMER_2);
  });

  it('prefers the owned customer over the worker row when a user is both', () => {
    expect(
      resolveScopedCustomerId({
        isAdmin: false,
        cookieCustomerId: null,
        ownedCustomerId: CUSTOMER_1,
        workerCustomerId: CUSTOMER_2,
      })
    ).toBe(CUSTOMER_1);
  });

  it('ignores a forged cookie from a non-admin', () => {
    // A non-admin who hand-crafts a valid cookie for another tenant gets their
    // own scope, not the forged one. This is why the cookie needs no signing.
    expect(
      resolveScopedCustomerId({
        isAdmin: false,
        cookieCustomerId: CUSTOMER_2,
        ownedCustomerId: CUSTOMER_1,
        workerCustomerId: null,
      })
    ).toBe(CUSTOMER_1);
  });

  it('gives a user with no tenancy at all no scope', () => {
    // A self-registered user: authenticates fine, has no customers row, no
    // workers row and no role.
    expect(
      resolveScopedCustomerId({
        isAdmin: false,
        cookieCustomerId: CUSTOMER_1,
        ownedCustomerId: null,
        workerCustomerId: null,
      })
    ).toBeNull();
  });
});
