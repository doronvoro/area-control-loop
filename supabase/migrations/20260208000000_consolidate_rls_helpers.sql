-- =============================================================================
-- CONSOLIDATE RLS HELPER FUNCTIONS
-- =============================================================================
-- This migration adds new helper functions to simplify RLS policies.
-- It does NOT change existing policies - those remain as-is for backward compatibility.
--
-- New functions:
--   - can_access_customer(customer_id, user_id)
--   - can_access_area(area_id, user_id)
--   - is_worker_type(user_id, worker_type)
--
-- These functions can be used in future policies to reduce complexity.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- CUSTOMER ACCESS CHECK
-- -----------------------------------------------------------------------------
-- Unified check for customer access: owner OR worker OR admin
-- This simplifies policies by centralizing the access logic.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION can_access_customer(p_customer_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT
    -- User is admin
    is_admin_user(p_user_id)
    OR
    -- User is the customer owner
    EXISTS (
      SELECT 1 FROM customers
      WHERE id = p_customer_id AND user_id = p_user_id
    )
    OR
    -- User is a worker in this customer
    is_worker_in_customer(p_customer_id, p_user_id);
$$ LANGUAGE sql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION can_access_customer IS 'Check if user can access a customer: admin OR owner OR worker.';


-- -----------------------------------------------------------------------------
-- AREA ACCESS CHECK
-- -----------------------------------------------------------------------------
-- Unified check for area access through customer_areas relationship.
-- Returns true if:
--   - User is admin, OR
--   - User's customer has access to this area via customer_areas
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION can_access_area(p_area_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT
    -- User is admin
    is_admin_user(p_user_id)
    OR
    -- User's customer has access to this area
    EXISTS (
      SELECT 1 FROM customer_areas ca
      JOIN customers c ON c.id = ca.customer_id
      WHERE ca.area_id = p_area_id
      AND (c.user_id = p_user_id OR is_worker_in_customer(c.id, p_user_id))
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION can_access_area IS 'Check if user can access an area through their customer.';


-- -----------------------------------------------------------------------------
-- WORKER TYPE CHECK
-- -----------------------------------------------------------------------------
-- Check if user is a specific type of worker (inspector, action_worker).
-- Useful for policies that need role-based access.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_worker_type(p_user_id UUID, p_worker_type TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM workers w
    JOIN worker_types wt ON wt.id = w.type_id
    WHERE w.user_id = p_user_id
    AND wt.name = p_worker_type
  );
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION is_worker_type IS 'Check if user is a specific worker type (inspector, action_worker).';


-- -----------------------------------------------------------------------------
-- REPORT AREA ACCESS CHECK
-- -----------------------------------------------------------------------------
-- Check if user can access a report_area.
-- Returns true if user can access the parent area.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION can_access_report_area(p_report_area_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT
    is_admin_user(p_user_id)
    OR
    EXISTS (
      SELECT 1 FROM report_areas ra
      WHERE ra.id = p_report_area_id
      AND can_access_area(ra.area_id, p_user_id)
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION can_access_report_area IS 'Check if user can access a report area through the parent area.';


-- =============================================================================
-- EXAMPLE: How to use these functions in future policies
-- =============================================================================
-- Instead of complex multi-table EXISTS chains, you can now write:
--
-- CREATE POLICY "simple_area_select" ON areas FOR SELECT
--   USING (can_access_area(id, auth.uid()));
--
-- CREATE POLICY "simple_report_area_select" ON report_areas FOR SELECT
--   USING (can_access_area(area_id, auth.uid()));
--
-- CREATE POLICY "inspectors_can_insert" ON monitoring_area_report FOR INSERT
--   WITH CHECK (is_worker_type(auth.uid(), 'inspector'));
-- =============================================================================
