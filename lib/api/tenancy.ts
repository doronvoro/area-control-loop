import type { ApiContext } from './auth-context';
import { resolveCustomerId } from './auth-context';
import { assertAreaVisible } from './utils';
import { getCustomerAreaIds } from '@/lib/services/customer-area.service';
import { AuthError } from '@/lib/auth';

/**
 * The area ids a request should be narrowed to, or null when no narrowing applies.
 *
 * THE RETURN VALUES ARE NOT INTERCHANGEABLE:
 *
 *   null  →  add no filter. Reserved for callers that genuinely span tenants;
 *            nothing returns it today. Kept because the difference between
 *            "unscoped" and "scoped to nothing" has to stay expressible — the
 *            two are one character apart at every call site and mean opposite
 *            things.
 *
 *   []    →  the request IS scoped, to something with no areas: an admin who
 *            has not picked a customer, a customer with no areas yet, or a user
 *            with no tenancy at all. The response must be empty. Treating this
 *            as "no filter" would show that caller everything — the exact
 *            inversion this helper exists to prevent.
 *
 * Callers must branch on null explicitly rather than on truthiness, because an
 * empty array is truthy in the one place it matters and falsy nowhere useful.
 *
 * Narrowing only. RLS remains the enforcement boundary; this decides what a
 * permitted caller is currently looking at.
 */
export async function scopedAreaIds(
  ctx: ApiContext,
  override?: string | null
): Promise<string[] | null> {
  const customerId = resolveCustomerId(ctx, override);

  // An admin with no selection is scoped to nothing, not to everything. Before
  // the switcher they saw every tenant merged together; now the empty result
  // drives a "choose a customer" banner instead.
  if (!customerId) return [];

  return getCustomerAreaIds(ctx.supabase, customerId);
}

/**
 * Assert that a caller-supplied area id is within the current scope.
 *
 * For routes that take an explicit ?areaId= rather than listing everything.
 * Two distinct checks, because they answer different questions:
 *
 *   - inside a customer scope: the area must belong to that customer. This is
 *     stricter than RLS — an admin can SEE every area, so without it a selected
 *     customer would not actually constrain an admin passing another tenant's id.
 *   - with no scope (an admin who has not selected): fall back to visibility,
 *     which is RLS's answer.
 */
export async function assertAreaInScope(ctx: ApiContext, areaId: string): Promise<void> {
  const areaIds = await scopedAreaIds(ctx);

  if (areaIds !== null) {
    if (!areaIds.includes(areaId)) {
      throw new AuthError('אין הרשאה לגשת לשטח זה', 403);
    }
    // Membership came from customer_areas, so tenancy is already proven.
    return;
  }

  await assertAreaVisible(ctx.supabase, areaId);
}

/**
 * NOTE ON A WRAPPER THAT IS DELIBERATELY ABSENT
 *
 * An `applyAreaScope(ctx, query)` helper that took a query builder and returned
 * a filtered one looks obvious and is a trap: PostgREST builders are thenable,
 * so returning one from an `async` function makes `await` execute the query and
 * resolve to its response instead of handing back the builder. Every caller
 * would silently run its query one step early.
 *
 * Callers apply the filter inline instead — three lines, and the null-vs-[]
 * branch stays visible at the point where getting it wrong matters:
 *
 *   const areaIds = await scopedAreaIds(ctx);
 *   if (areaIds !== null && areaIds.length === 0) return NextResponse.json([]);
 *   if (areaIds !== null) query = query.in('area_id', areaIds);
 */
