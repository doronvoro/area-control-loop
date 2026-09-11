-- Olive rollout — VERIFY. Read-only. Run straight after the migrations,
-- BEFORE merging anything else and BEFORE the data import.
--
-- The point of running this before the import is attribution: if the existing
-- tenant regresses here, it is unambiguously the RLS drop in migration 2, not
-- the import.

\echo '=== 1. all 9 olive tables now exist (expect 9 rows) ==='
select table_name from information_schema.tables
where table_schema = 'public' and table_name in (
  'parameters','parameter_rules','olive_plot_details','seasons',
  'yield_estimates','variety_windows','weather_days','nir_report','harvest_report')
order by table_name;

\echo ''
\echo '=== 2. report_number is a BY DEFAULT identity (this unblocks the core screens) ==='
select column_name, is_identity, identity_generation
from information_schema.columns
where table_schema = 'public' and table_name = 'report_areas' and column_name = 'report_number';

\echo ''
\echo '=== 3. seeded lookup data ==='
select 'parameters' t, count(*) from parameters
union all select 'parameter_rules', count(*) from parameter_rules
order by t;
-- expect parameters 7; parameter_rules split oil 3 / water 4 / dry 3:
select parameter_code, count(*) from parameter_rules group by parameter_code order by parameter_code;

\echo ''
\echo '=== 4. report types (expect exactly: action, harvest, monitoring, nir) ==='
select name from report_area_types order by name;

\echo ''
\echo '=== 5. the recursion policy is gone from areas ==='
select polname from pg_policy where polrelid = 'public.areas'::regclass order by polname;
-- "Users can view areas through report areas" must NOT be listed.
-- "Users can view accessible areas" and "Admins can view all areas" must be.

\echo ''
\echo '=== 6. baseline counts — compare against 00-preflight step 8 ==='
-- Nothing should have changed yet. The migrations add no rows to these tables.
select 'areas' t, count(*) from areas
union all select 'customers', count(*) from customers
union all select 'customer_areas', count(*) from customer_areas
union all select 'sub_areas', count(*) from sub_areas
union all select 'report_areas', count(*) from report_areas
union all select 'workers', count(*) from workers
order by t;

\echo ''
\echo '=== 7. no olive data yet (all must be 0) ==='
select 'olive_plot_details' t, count(*) from olive_plot_details
union all select 'yield_estimates', count(*) from yield_estimates
union all select 'nir_report', count(*) from nir_report
union all select 'harvest_report', count(*) from harvest_report
union all select 'variety_windows', count(*) from variety_windows
order by t;

-- THEN, before going further, exercise the LIVE SITE as the existing customer
-- and as one of their workers:
--   /areas · /reports (area names must render, not "-") · open a report detail
--   sheet · /actions · /map
-- Those are exactly the surfaces migration 2 changes. If area names go blank,
-- run 03-rollback.sql's POLICY section only, stop, and re-plan the RLS fix.
