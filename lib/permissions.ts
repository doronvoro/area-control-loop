/**
 * Permission checking utilities for server components/pages
 */

import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from './auth';

/**
 * Check if current user has a specific permission
 */
export async function hasPermission(permissionName: string): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;

  const supabase = await createClient();
  const { data, error } = await (supabase.rpc as any)('has_permission', {
    p_user_id: user.id,
    p_permission_name: permissionName,
  });

  if (error) {
    console.error('Error checking permission:', error);
    return false;
  }

  return data === true;
}

/**
 * Check if current user has a specific role
 */
export async function hasRole(roleName: string): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;

  const supabase = await createClient();
  const { data, error } = await (supabase.rpc as any)('has_role', {
    p_user_id: user.id,
    p_role_name: roleName,
  });

  if (error) {
    console.error('Error checking role:', error);
    return false;
  }

  return data === true;
}
