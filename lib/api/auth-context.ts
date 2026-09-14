import { createClient, createAdminClient } from '@/lib/supabase/server';
import { AuthError } from '@/lib/auth';
import { headers, cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import {
  SELECTED_CUSTOMER_COOKIE,
  parseSelectionCookie,
  resolveScopedCustomerId,
} from './customer-selection';

export interface ApiContext {
  supabase: SupabaseClient;
  adminClient: SupabaseClient;
  user: User;
  worker: any | null;
  customer: any | null;
  isAdmin: boolean;
  /**
   * The customer this request is scoped to: an admin's selected customer, or
   * for everyone else their own tenancy. Null for an admin who has not selected
   * one, and for a user with no tenancy at all.
   *
   * Scoping only — not an authorization boundary. See lib/api/customer-selection.ts.
   */
  scopedCustomerId: string | null;
}

async function isBearerRequest(): Promise<boolean> {
  const headersList = await headers();
  const authHeader = headersList.get('authorization');
  return !!authHeader?.startsWith('Bearer ');
}

/** Everything getApiContext resolves except the service-role client. */
export type RequestScope = Omit<ApiContext, 'adminClient'>;

/**
 * Who is calling and which tenant they are scoped to.
 *
 * Separate from getApiContext because the service-role client is a hard
 * requirement there — createAdminClient throws when SUPABASE_SERVICE_ROLE_KEY
 * is unset — and the root landing page must not 500 on an env that only has the
 * anon key. Same auth check, same precedence, no admin powers.
 */
export async function getRequestScope(): Promise<RequestScope> {
  const supabase = await createClient();

  // Single auth check
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    if (await isBearerRequest()) {
      throw new AuthError('Unauthorized', 401);
    }
    redirect('/login');
  }

  // Parallel fetch of worker, customer, and admin role
  const [workerResult, customerResult, adminRoleResult] = await Promise.all([
    supabase
      .from('workers')
      .select('*, worker_types(*), customers(*)')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => data),
    supabase
      .from('customers')
      .select('*')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => data),
    (supabase.rpc as any)('has_role', {
      p_user_id: user.id,
      p_role_name: 'admin',
    }).then(({ data }: { data: boolean }) => data === true),
  ]);

  // Read after the role is known: the cookie is only consulted for admins, and
  // a Bearer (mobile) request carries no cookies at all, which is why the
  // ?customerId= override has to stay as the Bearer-compatible channel.
  const cookieStore = await cookies();
  const cookieCustomerId = parseSelectionCookie(
    cookieStore.get(SELECTED_CUSTOMER_COOKIE)?.value,
    user.id
  );

  return {
    supabase,
    user,
    worker: workerResult,
    customer: customerResult,
    isAdmin: adminRoleResult,
    scopedCustomerId: resolveScopedCustomerId({
      isAdmin: adminRoleResult,
      cookieCustomerId,
      ownedCustomerId: (customerResult as { id?: string } | null)?.id ?? null,
      workerCustomerId: (workerResult as { customer_id?: string } | null)?.customer_id ?? null,
    }),
  };
}

/**
 * Get a unified API context with a single auth check and parallel data fetching.
 * Replaces the pattern of calling requireAuth + getCurrentWorker + getCurrentCustomer + hasRole separately.
 * Throws AuthError (401) for Bearer requests without a valid user, or redirects to /login for web requests.
 */
export async function getApiContext(): Promise<ApiContext> {
  const scope = await getRequestScope();
  return { ...scope, adminClient: createAdminClient() };
}

/**
 * Check if the context has a worker or admin — returns 401 response if neither.
 */
export function requireWorkerOrAdmin(ctx: ApiContext): NextResponse | null {
  if (!ctx.worker && !ctx.isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

/**
 * Check if the context has a worker, admin, or customer — returns 401 response if none.
 */
export function requireWorkerAdminOrCustomer(ctx: ApiContext): NextResponse | null {
  if (!ctx.worker && !ctx.isAdmin && !ctx.customer) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

/**
 * Check if the user has a specific permission. Uses the existing supabase client from context.
 */
export async function checkPermission(ctx: ApiContext, permissionName: string): Promise<boolean> {
  const { data, error } = await (ctx.supabase.rpc as any)('has_permission', {
    p_user_id: ctx.user.id,
    p_permission_name: permissionName,
  });
  if (error) {
    console.error('Error checking permission:', error);
    return false;
  }
  return data === true;
}

/**
 * Check if the user has a specific role. Uses the existing supabase client from context.
 */
export async function checkRole(ctx: ApiContext, roleName: string): Promise<boolean> {
  if (roleName === 'admin') return ctx.isAdmin;
  const { data, error } = await (ctx.supabase.rpc as any)('has_role', {
    p_user_id: ctx.user.id,
    p_role_name: roleName,
  });
  if (error) {
    console.error('Error checking role:', error);
    return false;
  }
  return data === true;
}

/**
 * Check if the user is admin or customer_owner — returns 403 response if neither.
 */
export async function requireAdminOrCustomerOwner(ctx: ApiContext): Promise<NextResponse | null> {
  if (!ctx.isAdmin && !(await checkRole(ctx, 'customer_owner'))) {
    return NextResponse.json({ error: 'אין הרשאה' }, { status: 403 });
  }
  return null;
}

/**
 * Which customer's data this request is scoped to.
 *
 * Order: admin's explicit ?customerId= override → the resolved scope (an
 * admin's selected customer, or the caller's own tenancy) → legacy fallback.
 *
 * THE OVERRIDE IS ADMIN-ONLY. It used to win for anyone who passed it. That was
 * harmless in most routes only because the follow-up query ran through the
 * RLS-scoped client and came back empty — but `/api/customer-areas` GET runs on
 * `adminClient`, where it was a genuine cross-tenant read. Gating it here fixes
 * that at the source rather than route by route.
 *
 * The override is kept rather than removed because it is the only channel that
 * works for Bearer (mobile) requests, which carry no cookies and therefore have
 * no selection.
 *
 * An admin with no selection resolves to null and therefore sees nothing until
 * they choose. There is deliberately no fallback to a `customers` row they may
 * hold: the old create-admin script gave admins one linked to every area, so
 * falling back would silently restore the unscoped view and make the switcher
 * look broken. `scopedCustomerId` already encodes that precedence.
 */
export function resolveCustomerId(ctx: RequestScope, override?: string | null): string | null {
  if (ctx.isAdmin && override) return override;
  return ctx.scopedCustomerId;
}
