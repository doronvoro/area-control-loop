import { createClient, createAdminClient } from '@/lib/supabase/server';
import { AuthError } from '@/lib/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import type { SupabaseClient, User } from '@supabase/supabase-js';

export interface ApiContext {
  supabase: SupabaseClient;
  adminClient: SupabaseClient;
  user: User;
  worker: any | null;
  customer: any | null;
  isAdmin: boolean;
}

async function isBearerRequest(): Promise<boolean> {
  const headersList = await headers();
  const authHeader = headersList.get('authorization');
  return !!authHeader?.startsWith('Bearer ');
}

/**
 * Get a unified API context with a single auth check and parallel data fetching.
 * Replaces the pattern of calling requireAuth + getCurrentWorker + getCurrentCustomer + hasRole separately.
 * Throws AuthError (401) for Bearer requests without a valid user, or redirects to /login for web requests.
 */
export async function getApiContext(): Promise<ApiContext> {
  const supabase = await createClient();
  const adminClient = createAdminClient();

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

  return {
    supabase,
    adminClient,
    user,
    worker: workerResult,
    customer: customerResult,
    isAdmin: adminRoleResult,
  };
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
 * Resolve the customer ID from context, with optional override.
 * Tries: explicit override → customer.id → worker.customer_id
 */
export function resolveCustomerId(ctx: ApiContext, override?: string | null): string | null {
  return override || ctx.customer?.id || ctx.worker?.customer_id || null;
}
