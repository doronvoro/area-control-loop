/**
 * Permission checking utilities
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

/**
 * Get all roles for current user
 */
export async function getUserRoles(): Promise<string[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('user_roles')
    .select('roles(name)')
    .eq('user_id', user.id);

  if (error) {
    console.error('Error fetching user roles:', error);
    return [];
  }

  return (data || []).map((ur: any) => ur.roles?.name).filter(Boolean);
}

/**
 * Get all permissions for current user
 */
export async function getUserPermissions(): Promise<string[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('user_roles')
    .select('roles(role_permissions(permissions(name)))')
    .eq('user_id', user.id);

  if (error) {
    console.error('Error fetching user permissions:', error);
    return [];
  }

  const permissions = new Set<string>();
  (data || []).forEach((ur: any) => {
    const role = ur.roles;
    if (role?.role_permissions) {
      role.role_permissions.forEach((rp: any) => {
        if (rp.permissions?.name) {
          permissions.add(rp.permissions.name);
        }
      });
    }
  });

  return Array.from(permissions);
}

/**
 * Require a specific permission (throws error if not present)
 */
export async function requirePermission(permissionName: string): Promise<void> {
  const has = await hasPermission(permissionName);
  if (!has) {
    throw new Error(`Permission denied: ${permissionName}`);
  }
}

/**
 * Require a specific role (throws error if not present)
 */
export async function requireRole(roleName: string): Promise<void> {
  const has = await hasRole(roleName);
  if (!has) {
    throw new Error(`Role required: ${roleName}`);
  }
}
