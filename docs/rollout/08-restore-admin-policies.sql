-- Restore the missing admin RLS policies. Writes 7 policies.
--
-- WHAT THE PROBE FOUND
-- Seven of the eight "Admins can view all X" policies are absent from
-- production: customers, customer_areas, areas, sub_areas, workers,
-- monitoring_area_report, actions_area_report. Only report_areas exists, and
-- only because a LATER migration (20260213000000_fix_is_admin_function.sql)
-- re-created it independently.
--
-- All seven come from 20260125000000_fix_admin_rls_policies.sql, so that
-- migration never applied here. This file is that migration's policies, made
-- re-runnable.
--
-- WHAT IT MEANS TODAY
-- An admin on production currently sees NO customers, NO areas, NO sub-areas,
-- NO workers and NO monitoring or action reports — but DOES see report_areas.
-- Admin screens are not merely unscoped, they are broken, and incoherently so.
-- /admin/customers renders an empty list. That is the state before any of this
-- work, not something it introduced.
--
-- WHY IT IS SAFE
-- Every statement adds a PERMISSIVE SELECT policy gated on is_admin_user().
-- Permissive policies OR together, so no existing user gains or loses anything:
-- the only accounts affected are those holding the admin role. If production
-- currently has zero admins (probe query 2), applying this changes nothing
-- observable until someone is promoted.
--
-- It does NOT touch report_areas: that policy already exists and is correct.
-- Dropping and recreating it would be churn on a live policy for no gain.
--
-- Re-runnable: Postgres has no CREATE POLICY IF NOT EXISTS, so each create is
-- preceded by a DROP IF EXISTS. Definitions are copied verbatim from the
-- migration so that applying this makes production match what
-- `npx supabase db reset` produces locally.

BEGIN;

-- The function the policies depend on. Already present (the probe confirmed
-- prosecdef = true); included so this file stands alone on a fresh database.
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

DROP POLICY IF EXISTS "Admins can view all customers" ON customers;
CREATE POLICY "Admins can view all customers"
  ON customers FOR SELECT
  USING (is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admins can view all customer areas" ON customer_areas;
CREATE POLICY "Admins can view all customer areas"
  ON customer_areas FOR SELECT
  USING (is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admins can view all areas" ON areas;
CREATE POLICY "Admins can view all areas"
  ON areas FOR SELECT
  USING (is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admins can view all sub-areas" ON sub_areas;
CREATE POLICY "Admins can view all sub-areas"
  ON sub_areas FOR SELECT
  USING (is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admins can view all workers" ON workers;
CREATE POLICY "Admins can view all workers"
  ON workers FOR SELECT
  USING (is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admins can view all monitoring reports" ON monitoring_area_report;
CREATE POLICY "Admins can view all monitoring reports"
  ON monitoring_area_report FOR SELECT
  USING (is_admin_user(auth.uid()));

DROP POLICY IF EXISTS "Admins can view all action reports" ON actions_area_report;
CREATE POLICY "Admins can view all action reports"
  ON actions_area_report FOR SELECT
  USING (is_admin_user(auth.uid()));

COMMIT;


-- Verify: re-run query 1 of 06-admin-probe.sql. All eight rows must read OK.
--
-- Then confirm nothing widened for non-admins — this should be unchanged,
-- since every policy added above requires is_admin_user():
--
-- select polrelid::regclass::text as tbl, polname
-- from pg_policy
-- where polrelid in ('public.areas'::regclass, 'public.customers'::regclass)
--   and pg_get_expr(polqual, polrelid) not ilike '%is_admin_user%'
-- order by tbl, polname;
