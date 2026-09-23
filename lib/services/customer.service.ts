import type { SupabaseClient } from '@supabase/supabase-js';
import { CustomerType } from '@/types/database';

/**
 * Customer profile writes and the login-email lookup.
 *
 * The route stays thin and the field whitelist becomes testable. The whitelist
 * is the point: `customers` now has ten writable descriptive columns, and
 * spreading a request body into an update is how `user_id` and `created_at` get
 * overwritten by a client that sends them.
 */

/** Everything a client may write, other than the credentials and the type. */
const PROFILE_FIELDS = [
  'name',
  'description',
  'contact_person',
  'contact_phone',
  'contact_mobile',
  'contact_email',
  'address',
  'city',
  'business_id',
  'notes',
] as const;

const CUSTOMER_TYPES: string[] = Object.values(CustomerType);

/** Is this a code the customer_type CHECK will accept? */
export function isCustomerType(value: unknown): boolean {
  return typeof value === 'string' && CUSTOMER_TYPES.includes(value);
}

/**
 * Empty string to null.
 *
 * Every text field arrives from a react-hook-form input, which yields '' for
 * "not filled in" — storing that would make `city IS NULL` and `city = ''` both
 * mean "no city", and the grid would have to handle two empties.
 */
function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/** The row POST hands to `.insert()`, inside createUserWithRole's closure. */
export function buildCustomerInsert(
  body: Record<string, unknown>,
  userId: string
): Record<string, unknown> {
  const row: Record<string, unknown> = { user_id: userId };

  for (const field of PROFILE_FIELDS) {
    row[field] = text(body[field]);
  }
  // Re-asserted after the loop: `name` is NOT NULL, and text() would have
  // turned a whitespace-only name into one.
  row.name = String(body.name ?? '').trim();
  row.customer_type = isCustomerType(body.customer_type) ? body.customer_type : null;
  row.is_active = body.is_active !== false;

  return row;
}

/**
 * The patch PUT hands to `.update()`.
 *
 * `customer_type` and `is_active` are dropped for a non-admin: classifying a
 * tenant and deactivating it are the operator's calls, not the tenant's, and
 * `customer_owner` holds `update_customer` so it can maintain its own contact
 * details. Dropped silently rather than 403'd — the admin screen never sends
 * them from a non-admin session, so a 403 would only ever fire on a hand-rolled
 * request.
 *
 * `id`, `user_id` and `created_at` are never copied. Only keys actually present
 * in the body are written, so a partial patch stays partial.
 */
export function buildCustomerUpdate(
  body: Record<string, unknown>,
  { isAdmin }: { isAdmin: boolean }
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  for (const field of PROFILE_FIELDS) {
    if (field in body) patch[field] = text(body[field]);
  }
  if ('name' in body) patch.name = String(body.name ?? '').trim();

  if (isAdmin) {
    if ('customer_type' in body) {
      patch.customer_type = isCustomerType(body.customer_type) ? body.customer_type : null;
    }
    if ('is_active' in body) patch.is_active = body.is_active !== false;
  }

  return patch;
}

/** GoTrue pages at 1000; five pages is ~5000 users, well past this project. */
const LIST_USERS_PAGE_SIZE = 1000;
const LIST_USERS_MAX_PAGES = 5;

/**
 * auth.users email per user id — the LOGIN identity, which is not a `customers`
 * column and never will be.
 *
 * One paged sweep rather than N getUserById calls: the grid needs every tenant's
 * address at once, and a request per row would make the customer list O(tenants)
 * round-trips to GoTrue.
 *
 * The sweep covers ALL users, workers included, so the page cap is about total
 * accounts rather than tenants. Past the cap some rows show '—' instead of a
 * wrong address, and a console.warn says why.
 *
 * Returns {} on any throw. A failed auth lookup must never fail the customer
 * list — the login email is a convenience column, and every other field on the
 * screen came from Postgres and is fine.
 */
export async function getLoginEmails(
  adminClient: SupabaseClient,
  userIds: string[]
): Promise<Record<string, string>> {
  if (userIds.length === 0) return {};

  const wanted = new Set(userIds);
  const emails: Record<string, string> = {};

  try {
    for (let page = 1; page <= LIST_USERS_MAX_PAGES; page++) {
      const { data, error } = await adminClient.auth.admin.listUsers({
        page,
        perPage: LIST_USERS_PAGE_SIZE,
      });
      if (error) throw error;

      const users = data?.users ?? [];
      for (const user of users) {
        if (user.email && wanted.has(user.id)) emails[user.id] = user.email;
      }

      // A short page is the last page. Stopping once every wanted id is found
      // would be wrong only in that it saves nothing — the first page already
      // holds them all at this scale.
      if (users.length < LIST_USERS_PAGE_SIZE) return emails;
      if (Object.keys(emails).length === wanted.size) return emails;
    }

    console.warn(
      `getLoginEmails: stopped after ${LIST_USERS_MAX_PAGES} pages; ` +
        `${wanted.size - Object.keys(emails).length} login email(s) unresolved.`
    );
    return emails;
  } catch (error) {
    console.error('Error loading login emails:', error);
    return {};
  }
}
