import { AreaTypeId } from '@/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AuthError } from '@/lib/auth';

/**
 * Confirm the caller may write to this area, and return its name.
 *
 * Reads through the RLS-scoped client, so "can this user see the area" is
 * answered by the same policies that govern every other read. Callers that go
 * on to write via `adminClient` MUST pass that check first — the admin client
 * bypasses RLS entirely, so without this the only thing standing between a
 * request body's `area_id` and a row is nothing at all.
 *
 * This existed as a name lookup whose empty result was shrugged off
 * (`areaData?.name || 'אזור'`), which meant any authenticated user who guessed
 * or enumerated another tenant's area id could create reports against it via
 * POST /api/monitoring or POST /api/actions. The lookup was already the right
 * check; it just was not being enforced.
 */
export async function assertAreaVisible(
  supabase: SupabaseClient,
  areaId: string
): Promise<string> {
  const { data } = await supabase.from('areas').select('name').eq('id', areaId).single();

  if (!data) {
    // Deliberately not 404: whether the area exists is itself tenant
    // information, and the caller has no business distinguishing the two.
    throw new AuthError('אין הרשאה לדווח על שטח זה', 403);
  }

  return (data as { name: string }).name;
}

/**
 * Parse a dosage value that may come as string, number, null, or undefined.
 */
export function parseDosage(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  return typeof value === 'string' ? parseFloat(value) : value;
}

/**
 * Look up a worker_type ID by name (e.g. 'inspector', 'action_worker').
 */
export async function getWorkerTypeId(
  supabase: SupabaseClient,
  typeName: string
): Promise<string | null> {
  const { data } = await (supabase.from('worker_types') as any)
    .select('id')
    .eq('name', typeName)
    .single();
  return data?.id || null;
}

/**
 * Look up worker_type IDs by multiple names.
 * Used to include 'both' type workers alongside specific types.
 */
export async function getWorkerTypeIds(
  supabase: SupabaseClient,
  typeNames: string[]
): Promise<string[]> {
  const { data } = await (supabase.from('worker_types') as any)
    .select('id')
    .in('name', typeNames);
  return (data || []).map((d: { id: string }) => d.id);
}

/**
 * Find an existing report area or create a new one.
 * - reuseExisting: true (default for actions) — returns existing report_area if found
 * - reuseExisting: false (default for monitoring) — always creates a new report_area
 */
export async function findOrCreateReportArea(
  supabase: SupabaseClient,
  adminClient: SupabaseClient,
  areaId: string,
  areaTypeId: string,
  options?: {
    reuseExisting?: boolean;
    workerId?: string;
    namePrefix?: string;
    description?: string;
    reportDate?: string;
  }
): Promise<string> {
  const {
    reuseExisting = false,
    workerId,
    namePrefix = areaTypeId === AreaTypeId.MONITORING ? 'דוח ניטור' : 'דוח פעולה',
    description = areaTypeId === AreaTypeId.MONITORING ? 'דוח ניטור' : 'דוח פעולה',
    reportDate,
  } = options || {};

  // Check for existing report area if reuse is enabled
  if (reuseExisting) {
    const { data: existing } = await (supabase.from('report_areas') as any)
      .select('id')
      .eq('area_id', areaId)
      .eq('area_type_id', areaTypeId);

    if (existing && existing.length > 0) {
      return existing[0].id;
    }
  }

  // Membership check AND the name lookup, in one read. Throws 403 when the
  // caller cannot see the area — the insert below goes through adminClient and
  // would otherwise accept any area id in the request body.
  const areaName = await assertAreaVisible(supabase, areaId);

  const { data: newReportArea, error } = await adminClient
    .from('report_areas')
    .insert({
      area_id: areaId,
      area_type_id: areaTypeId,
      name: `${namePrefix} - ${areaName}`,
      description,
      worker_id: workerId || null,
      report_date: reportDate || null,
    })
    .select('id')
    .single();

  if (error) throw error;
  return (newReportArea as any).id;
}

/**
 * Create a user with auth account, domain record, and role assignment.
 * Handles rollback if domain record creation fails.
 */
/**
 * Best-effort cleanup of a half-created user.
 *
 * There is no transaction across GoTrue and Postgres, so a failure partway
 * through leaves an auth account with no domain record or no role. Deleting the
 * auth user is the only step that undoes something the caller can see.
 *
 * Its own failure is swallowed deliberately: the caller is already throwing the
 * error that matters, and replacing it with "rollback failed" would hide the
 * cause. A stranded auth user is recoverable; a misleading error is not.
 */
async function rollbackUser(adminClient: SupabaseClient, userId: string): Promise<void> {
  try {
    await adminClient.auth.admin.deleteUser(userId);
  } catch {
    // Intentionally ignored — see above.
  }
}

export async function createUserWithRole(
  adminClient: SupabaseClient,
  params: {
    email: string;
    password: string;
    name: string;
    roleName: string;
    userMetadataRole: string;
    insertRecord: (userId: string) => Promise<{ data: any; error: any }>;
  }
): Promise<{ user: any; record: any }> {
  const { email, password, name, roleName, userMetadataRole, insertRecord } = params;

  // Create auth user
  const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, role: userMetadataRole },
  });

  if (authError) {
    if (authError.message.includes('already been registered')) {
      throw new DuplicateEmailError('משתמש עם אימייל זה כבר קיים');
    }
    throw authError;
  }

  if (!authData.user) {
    throw new Error('Failed to create user');
  }

  // Create domain record
  const { data: record, error: recordError } = await insertRecord(authData.user.id);

  if (recordError) {
    await rollbackUser(adminClient, authData.user.id);
    throw recordError;
  }

  // Assign role.
  //
  // Previously the lookup error was discarded and `if (roleData)` made an
  // unknown roleName a silent no-op that still returned 201 Created: the caller
  // got an account that could log in and had no permissions, while the UI said
  // "הלקוח נוצר בהצלחה". The user_roles insert error was not checked either.
  // Both are now hard failures, and both roll back.
  const { data: roleData, error: roleLookupError } = await (adminClient.from('roles') as any)
    .select('id')
    .eq('name', roleName)
    .single();

  if (roleLookupError || !roleData) {
    await rollbackUser(adminClient, authData.user.id);
    throw new Error(`לא נמצא תפקיד בשם "${roleName}" — המשתמש לא נוצר`);
  }

  const { error: roleInsertError } = await (adminClient.from('user_roles') as any).insert({
    user_id: authData.user.id,
    role_id: roleData.id,
  });

  if (roleInsertError) {
    await rollbackUser(adminClient, authData.user.id);
    throw roleInsertError;
  }

  return { user: authData.user, record };
}

/**
 * Thrown when trying to create a user with an email that already exists.
 * Caught in routes to return 400 instead of 500.
 */
export class DuplicateEmailError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DuplicateEmailError';
  }
}
