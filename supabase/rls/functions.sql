-- =============================================================================
-- RLS HELPER FUNCTIONS
-- =============================================================================
-- This file contains all helper functions used by RLS policies.
-- These functions abstract complex access control logic and prevent infinite recursion.
--
-- IMPORTANT: This is a REFERENCE FILE documenting the current state of RLS functions.
-- Actual functions are created/modified in migrations. Update this file when making
-- changes to keep it in sync.
--
-- Last updated: 2026-02-08
-- =============================================================================

-- -----------------------------------------------------------------------------
-- ADMIN CHECK FUNCTION
-- -----------------------------------------------------------------------------
-- Checks if a user has the 'admin' role via user_roles table.
-- Uses SECURITY DEFINER to bypass RLS on user_roles table.
--
-- Created in: 20260125000000_fix_admin_rls_policies.sql
-- -----------------------------------------------------------------------------
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

COMMENT ON FUNCTION is_admin_user IS 'Check if user has admin role. Uses SECURITY DEFINER to bypass RLS.';


-- -----------------------------------------------------------------------------
-- WORKER MEMBERSHIP CHECK
-- -----------------------------------------------------------------------------
-- Checks if a user is a worker within a specific customer.
-- Used to prevent infinite recursion in workers table RLS policies.
--
-- Created in: 20260124193135_fix_rls_and_admin_access.sql
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_worker_in_customer(p_customer_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM workers
    WHERE customer_id = p_customer_id
    AND user_id = p_user_id
  );
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION is_worker_in_customer IS 'Check if user is a worker in the given customer. Prevents RLS recursion.';


-- -----------------------------------------------------------------------------
-- PERMISSION CHECK FUNCTION
-- -----------------------------------------------------------------------------
-- Checks if a user has a specific permission through their roles.
-- Traverses user_roles -> role_permissions -> permissions.
--
-- Created in: 006_roles_and_permissions.sql
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION has_permission(
  p_user_id UUID,
  p_permission_name TEXT
) RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN role_permissions rp ON rp.role_id = ur.role_id
    JOIN permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = p_user_id
    AND p.name = p_permission_name
  );
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION has_permission IS 'Check if a user has a specific permission through their roles.';


-- -----------------------------------------------------------------------------
-- ROLE CHECK FUNCTION
-- -----------------------------------------------------------------------------
-- Checks if a user has a specific role.
--
-- Created in: 006_roles_and_permissions.sql
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION has_role(
  p_user_id UUID,
  p_role_name TEXT
) RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN roles r ON r.id = ur.role_id
    WHERE ur.user_id = p_user_id
    AND r.name = p_role_name
  );
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION has_role IS 'Check if a user has a specific role.';


-- =============================================================================
-- CONSOLIDATED HELPER FUNCTIONS (NEW)
-- =============================================================================
-- These functions were added in migration 20260208000000_consolidate_rls_helpers.sql
-- They simplify RLS policies by centralizing complex access logic.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- CUSTOMER ACCESS CHECK
-- -----------------------------------------------------------------------------
-- Unified check for customer access: owner OR worker OR admin
-- Created in: 20260208000000_consolidate_rls_helpers.sql
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
-- Created in: 20260208000000_consolidate_rls_helpers.sql
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
-- Check if user is a specific type of worker (inspector, action_worker, both).
-- Created in: 20260208000000_consolidate_rls_helpers.sql
-- Updated in: 20260320000000_add_both_worker_type.sql
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

COMMENT ON FUNCTION is_worker_type IS 'Check if user is a specific worker type (inspector, action_worker, both).';


-- -----------------------------------------------------------------------------
-- REPORT AREA ACCESS CHECK
-- -----------------------------------------------------------------------------
-- Check if user can access a report_area through the parent area.
-- Created in: 20260208000000_consolidate_rls_helpers.sql
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
