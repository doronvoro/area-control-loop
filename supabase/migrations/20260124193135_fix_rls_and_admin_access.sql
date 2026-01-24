-- Fix RLS policies and add admin access
-- This migration fixes the infinite recursion issue and adds admin bypass

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Workers can view workers from their customer" ON workers;
DROP POLICY IF EXISTS "Users can view accessible areas" ON areas;
DROP POLICY IF EXISTS "Users can view accessible sub-areas" ON sub_areas;
DROP POLICY IF EXISTS "Users can view accessible report areas" ON report_areas;

-- Recreate workers policy without recursion
-- Use a function to check worker membership to avoid recursion
CREATE OR REPLACE FUNCTION is_worker_in_customer(p_customer_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM workers
    WHERE customer_id = p_customer_id
    AND user_id = p_user_id
  );
$$ LANGUAGE sql STABLE;

CREATE POLICY "Workers can view workers from their customer"
  ON workers FOR SELECT
  USING (
    -- Customer owners can see all workers in their customer
    EXISTS (
      SELECT 1 FROM customers
      WHERE customers.id = workers.customer_id
      AND customers.user_id = auth.uid()
    )
    OR
    -- Workers can see themselves
    workers.user_id = auth.uid()
    OR
    -- Workers can see other workers in the same customer (using function to avoid recursion)
    is_worker_in_customer(workers.customer_id, auth.uid())
  );

-- Recreate areas policy - allow access if user's customer is linked to area
CREATE POLICY "Users can view accessible areas"
  ON areas FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM customer_areas ca
      JOIN customers c ON c.id = ca.customer_id
      WHERE ca.area_id = areas.id
      AND c.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM customer_areas ca
      JOIN customers c ON c.id = ca.customer_id
      JOIN workers w ON w.customer_id = c.id
      WHERE ca.area_id = areas.id
      AND w.user_id = auth.uid()
    )
  );

-- Recreate sub-areas policy
CREATE POLICY "Users can view accessible sub-areas"
  ON sub_areas FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM areas a
      JOIN customer_areas ca ON ca.area_id = a.id
      JOIN customers c ON c.id = ca.customer_id
      WHERE a.id = sub_areas.area_id
      AND (
        c.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM workers w
          WHERE w.customer_id = c.id
          AND w.user_id = auth.uid()
        )
      )
    )
  );

-- Recreate report areas policy
CREATE POLICY "Users can view accessible report areas"
  ON report_areas FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM areas a
      JOIN customer_areas ca ON ca.area_id = a.id
      JOIN customers c ON c.id = ca.customer_id
      WHERE a.id = report_areas.area_id
      AND (
        c.user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM workers w
          WHERE w.customer_id = c.id
          AND w.user_id = auth.uid()
        )
      )
    )
  );

-- Add admin bypass for areas (users with role='admin' in user_metadata)
CREATE POLICY "Admins can view all areas"
  ON areas FOR SELECT
  USING (
    (auth.jwt() ->> 'user_metadata')::jsonb->>'role' = 'admin'
  );

-- Add admin bypass for sub-areas
CREATE POLICY "Admins can view all sub-areas"
  ON sub_areas FOR SELECT
  USING (
    (auth.jwt() ->> 'user_metadata')::jsonb->>'role' = 'admin'
  );

-- Add admin bypass for report areas
CREATE POLICY "Admins can view all report areas"
  ON report_areas FOR SELECT
  USING (
    (auth.jwt() ->> 'user_metadata')::jsonb->>'role' = 'admin'
  );

COMMENT ON POLICY "Admins can view all areas" ON areas IS 'Allows users with role=admin in user_metadata to view all areas';
COMMENT ON POLICY "Admins can view all sub-areas" ON sub_areas IS 'Allows users with role=admin in user_metadata to view all sub-areas';
COMMENT ON POLICY "Admins can view all report areas" ON report_areas IS 'Allows users with role=admin in user_metadata to view all report areas';
