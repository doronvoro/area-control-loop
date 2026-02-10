-- =============================================================================
-- RLS TEST QUERIES
-- =============================================================================
-- Use these queries to verify RLS policies are working correctly.
-- Run in Supabase SQL Editor or via psql.
--
-- USAGE:
--   1. Replace <USER_ID>, <CUSTOMER_ID>, etc. with actual UUIDs from your database
--   2. Run the test queries to verify expected behavior
--   3. Compare actual results with expected results
--
-- =============================================================================


-- =============================================================================
-- SETUP: Get test data IDs
-- =============================================================================
-- Run these first to get IDs for testing

-- Find an admin user
SELECT u.id as user_id, u.email, r.name as role
FROM auth.users u
JOIN user_roles ur ON ur.user_id = u.id
JOIN roles r ON r.id = ur.role_id
WHERE r.name = 'admin'
LIMIT 1;

-- Find a customer owner
SELECT c.id as customer_id, c.user_id, c.name as customer_name
FROM customers c
LIMIT 1;

-- Find a worker
SELECT w.id as worker_id, w.user_id, w.customer_id, wt.name as worker_type
FROM workers w
JOIN worker_types wt ON wt.id = w.type_id
LIMIT 3;

-- Find an area
SELECT a.id as area_id, a.name as area_name
FROM areas a
LIMIT 1;


-- =============================================================================
-- TEST 1: Admin Access
-- =============================================================================
-- Admins should see ALL data

-- Test helper function
SELECT is_admin_user('<ADMIN_USER_ID>'); -- Should return true

-- Simulate admin context (for testing in SQL editor)
-- Note: This only works in testing environments
/*
SET request.jwt.claims = '{"sub": "<ADMIN_USER_ID>"}';
SET ROLE authenticated;

-- Admin should see all customers
SELECT count(*) as customer_count FROM customers;

-- Admin should see all areas
SELECT count(*) as area_count FROM areas;

-- Admin should see all workers
SELECT count(*) as worker_count FROM workers;

RESET ROLE;
*/


-- =============================================================================
-- TEST 2: Customer Owner Access
-- =============================================================================
-- Customer owners should see their own data

-- Test can_access_customer function (after migration)
SELECT can_access_customer('<CUSTOMER_ID>', '<CUSTOMER_OWNER_USER_ID>'); -- Should return true
SELECT can_access_customer('<CUSTOMER_ID>', '<OTHER_USER_ID>'); -- Should return false (unless worker)


-- =============================================================================
-- TEST 3: Worker Access
-- =============================================================================
-- Workers should see their customer's data

-- Test is_worker_in_customer function
SELECT is_worker_in_customer('<CUSTOMER_ID>', '<WORKER_USER_ID>'); -- Should return true
SELECT is_worker_in_customer('<OTHER_CUSTOMER_ID>', '<WORKER_USER_ID>'); -- Should return false


-- =============================================================================
-- TEST 4: Area Access
-- =============================================================================
-- Areas should be visible based on customer_areas relationships

-- Test can_access_area function (after migration)
SELECT can_access_area('<AREA_ID>', '<ADMIN_USER_ID>'); -- Should return true
SELECT can_access_area('<AREA_ID>', '<CUSTOMER_OWNER_ID>'); -- Should return true if linked
SELECT can_access_area('<AREA_ID>', '<UNRELATED_USER_ID>'); -- Should return false


-- =============================================================================
-- TEST 5: Worker Type Access
-- =============================================================================
-- Test inspector and action_worker role checks

-- Test is_worker_type function (after migration)
SELECT is_worker_type('<INSPECTOR_USER_ID>', 'inspector'); -- Should return true
SELECT is_worker_type('<INSPECTOR_USER_ID>', 'action_worker'); -- Should return false
SELECT is_worker_type('<ACTION_WORKER_USER_ID>', 'action_worker'); -- Should return true


-- =============================================================================
-- TEST 6: Policy Verification
-- =============================================================================
-- Verify policies exist for all tables

-- Check RLS is enabled on all important tables
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN (
  'customers', 'workers', 'invitations', 'customer_areas',
  'areas', 'sub_areas', 'report_areas',
  'monitoring_area_report', 'actions_area_report', 'user_roles'
)
ORDER BY tablename;
-- All should show rowsecurity = true

-- Count policies per table
SELECT tablename, count(*) as policy_count
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY tablename
ORDER BY tablename;


-- =============================================================================
-- TEST 7: View All Policies (for debugging)
-- =============================================================================
-- See all policies for a specific table

SELECT
  policyname,
  cmd,
  roles,
  qual as using_expression,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'areas' -- Change table name as needed
ORDER BY policyname;


-- =============================================================================
-- TEST 8: Cross-table Access Chain
-- =============================================================================
-- Verify the full access chain works: customer -> customer_areas -> areas -> report_areas

-- Get a complete chain to test
SELECT
  c.id as customer_id,
  c.user_id as customer_owner,
  ca.area_id,
  a.name as area_name,
  ra.id as report_area_id,
  ra.report_date
FROM customers c
JOIN customer_areas ca ON ca.customer_id = c.id
JOIN areas a ON a.id = ca.area_id
LEFT JOIN report_areas ra ON ra.area_id = a.id
LIMIT 5;


-- =============================================================================
-- TEST 9: Negative Tests (should return empty/false)
-- =============================================================================
-- Verify users can't see what they shouldn't

-- Non-admin user checking admin status
SELECT is_admin_user('<NON_ADMIN_USER_ID>'); -- Should return false

-- Worker trying to access different customer
SELECT is_worker_in_customer('<OTHER_CUSTOMER_ID>', '<WORKER_USER_ID>'); -- Should return false


-- =============================================================================
-- TEST 10: Helper Function Performance
-- =============================================================================
-- Check that helper functions are efficient

EXPLAIN ANALYZE SELECT is_admin_user('<USER_ID>');
EXPLAIN ANALYZE SELECT is_worker_in_customer('<CUSTOMER_ID>', '<USER_ID>');
EXPLAIN ANALYZE SELECT can_access_area('<AREA_ID>', '<USER_ID>');


-- =============================================================================
-- QUICK HEALTH CHECK
-- =============================================================================
-- Run this to verify basic RLS setup is correct

DO $$
DECLARE
  rls_tables INT;
  tables_with_policies INT;
BEGIN
  -- Count tables with RLS enabled
  SELECT count(*) INTO rls_tables
  FROM pg_tables
  WHERE schemaname = 'public' AND rowsecurity = true;

  -- Count tables with at least one policy
  SELECT count(DISTINCT tablename) INTO tables_with_policies
  FROM pg_policies
  WHERE schemaname = 'public';

  RAISE NOTICE 'Tables with RLS enabled: %', rls_tables;
  RAISE NOTICE 'Tables with policies: %', tables_with_policies;

  IF rls_tables < 9 THEN
    RAISE WARNING 'Expected at least 9 tables with RLS enabled, found %', rls_tables;
  END IF;

  IF tables_with_policies < 9 THEN
    RAISE WARNING 'Expected at least 9 tables with policies, found %', tables_with_policies;
  END IF;
END $$;
