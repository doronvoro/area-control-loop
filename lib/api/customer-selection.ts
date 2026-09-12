/**
 * The admin's selected customer — cookie encoding and scope resolution.
 *
 * An admin sees every tenant at once, which makes support work impractical.
 * Selecting a customer narrows the app to that tenant. The selection travels in
 * a cookie because it is the only carrier that converges: there are ~150 client
 * `fetch('/api/…')` call sites and no server component fetches data, so a query
 * parameter would mean auditing all of them, while a cookie is read once in
 * getApiContext.
 *
 * THIS IS NOT AN AUTHORIZATION BOUNDARY. `is_admin_user()` short-circuits the
 * RLS policy on every tenant table, so an admin may read any tenant regardless
 * of what is selected — clearing the cookie restores the unscoped view. The
 * selection is a focus control. Never rely on it to contain an admin, and never
 * let it be the only thing guarding a write.
 *
 * Everything here is pure so the precedence rules can be tested directly; the
 * cookie is read and written in getApiContext and the selected-customer route.
 */

/** Cookie name. Prefixed to keep it clearly distinct from Supabase's own. */
export const SELECTED_CUSTOMER_COOKIE = 'acl_selected_customer';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Encode as `<userId>:<customerId>`.
 *
 * The user id is included because logout is client-side
 * (`supabase.auth.signOut()` in Sidebar/MobileMoreMenu) and never reaches a
 * route handler, so nothing can clear an httpOnly cookie on the way out.
 * Without the prefix the next admin to log in on the same machine would inherit
 * the previous admin's selection. One string compare closes that.
 */
export function serializeSelectionCookie(userId: string, customerId: string): string {
  return `${userId}:${customerId}`;
}

/**
 * Decode, returning the customer id only if the cookie belongs to this user.
 *
 * Deliberately no signing and no database lookup. The cookie is consulted only
 * when the caller is already known to be an admin, and an admin may legitimately
 * select any customer — so forging it grants nothing that asking for it would
 * not. Validation exists to stop malformed values producing confusing empty
 * screens, not to stop an attacker. A cookie naming a deleted customer simply
 * yields no rows, and the switcher clears it on noticing the id is not in the
 * list it already loads.
 */
export function parseSelectionCookie(
  raw: string | null | undefined,
  userId: string
): string | null {
  if (!raw) return null;

  // Split on the FIRST separator: the user id is a uuid and contains none, and
  // this stays correct even if the value is ever extended with more fields.
  const sep = raw.indexOf(':');
  if (sep === -1) return null;

  const owner = raw.slice(0, sep);
  const customerId = raw.slice(sep + 1);

  if (owner !== userId) return null;
  if (!UUID_RE.test(customerId)) return null;

  return customerId;
}

export interface ScopeInput {
  isAdmin: boolean;
  /** Already parsed and ownership-checked by parseSelectionCookie. */
  cookieCustomerId: string | null;
  /** `ctx.customer?.id` — the customer this user owns, if any. */
  ownedCustomerId: string | null;
  /** `ctx.worker?.customer_id` — the customer this user works for, if any. */
  workerCustomerId: string | null;
}

/**
 * Which customer's data this request is scoped to.
 *
 * For an admin the cookie is authoritative and **beats any customers or workers
 * row they happen to have**. That is not hypothetical: the old create-admin
 * script gave every admin a `customers` row linked to every area, so a plain
 * `cookie || owned || worker` chain would silently fall back to that legacy row
 * and the selection would appear to do nothing. Admins created that way still
 * exist.
 *
 * Non-admins ignore the cookie completely — their scope is their own tenancy.
 * A forged cookie therefore does nothing for them.
 */
export function resolveScopedCustomerId(input: ScopeInput): string | null {
  if (input.isAdmin) {
    return input.cookieCustomerId;
  }
  return input.ownedCustomerId || input.workerCustomerId || null;
}
