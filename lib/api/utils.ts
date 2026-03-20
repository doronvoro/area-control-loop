import { AreaTypeId } from '@/types/database';
import type { SupabaseClient } from '@supabase/supabase-js';

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

  // Get area name for the new report_area
  const { data: areaData } = await supabase
    .from('areas')
    .select('name')
    .eq('id', areaId)
    .single();

  const { data: newReportArea, error } = await adminClient
    .from('report_areas')
    .insert({
      area_id: areaId,
      area_type_id: areaTypeId,
      name: `${namePrefix} - ${areaData?.name || 'אזור'}`,
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
    // Rollback: delete the auth user
    await adminClient.auth.admin.deleteUser(authData.user.id);
    throw recordError;
  }

  // Assign role
  const { data: roleData } = await (adminClient.from('roles') as any)
    .select('id')
    .eq('name', roleName)
    .single();

  if (roleData) {
    await (adminClient.from('user_roles') as any).insert({
      user_id: authData.user.id,
      role_id: roleData.id,
    });
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
