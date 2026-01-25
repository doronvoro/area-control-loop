-- Fix admin RLS policies to use user_roles table instead of user_metadata
-- This allows admins to see all data regardless of customer associations

-- Create helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin_user(p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = p_user_id
    AND r.name = 'admin'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Drop old admin policies that use user_metadata
DROP POLICY IF EXISTS "Admins can view all areas" ON areas;
DROP POLICY IF EXISTS "Admins can view all sub-areas" ON sub_areas;
DROP POLICY IF EXISTS "Admins can view all report areas" ON report_areas;

-- Create new admin policies using user_roles
CREATE POLICY "Admins can view all areas"
  ON areas FOR SELECT
  USING (is_admin_user(auth.uid()));

CREATE POLICY "Admins can view all sub-areas"
  ON sub_areas FOR SELECT
  USING (is_admin_user(auth.uid()));

CREATE POLICY "Admins can view all report areas"
  ON report_areas FOR SELECT
  USING (is_admin_user(auth.uid()));

CREATE POLICY "Admins can view all customers"
  ON customers FOR SELECT
  USING (is_admin_user(auth.uid()));

CREATE POLICY "Admins can view all workers"
  ON workers FOR SELECT
  USING (is_admin_user(auth.uid()));

CREATE POLICY "Admins can view all monitoring reports"
  ON monitoring_area_report FOR SELECT
  USING (is_admin_user(auth.uid()));

CREATE POLICY "Admins can view all action reports"
  ON actions_area_report FOR SELECT
  USING (is_admin_user(auth.uid()));

CREATE POLICY "Admins can view all customer areas"
  ON customer_areas FOR SELECT
  USING (is_admin_user(auth.uid()));
