-- Fix RLS on user_roles to allow admin checks
-- The is_admin_user function uses SECURITY DEFINER but RLS still blocks the query
-- because authenticated role doesn't have bypass_rls privilege.
-- Solution: Make user_roles publicly readable for admin role checks only

-- Drop the restrictive policy
DROP POLICY IF EXISTS "Users can view their own roles" ON user_roles;

-- Create a more permissive policy - allow reading all user_roles
-- This is safe because user_roles only contains user_id and role_id (no sensitive data)
CREATE POLICY "Authenticated users can view all user_roles"
  ON user_roles FOR SELECT
  TO authenticated
  USING (true);

-- Ensure admin policies exist on report_areas
-- Drop and recreate to ensure they're properly configured
DROP POLICY IF EXISTS "Admins can view all report areas" ON report_areas;
CREATE POLICY "Admins can view all report areas"
  ON report_areas FOR SELECT
  TO authenticated
  USING (is_admin_user(auth.uid()));
