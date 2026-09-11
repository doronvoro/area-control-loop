-- Olive rollout — PRE-FLIGHT. Read-only. Run this first and keep the output.
--
-- It is the before-picture, half the rollback plan, and the fastest answer to
-- "is production broken right now?". Nothing here writes.
--
-- Run in: Supabase Studio → SQL Editor (or psql on the pooler, port 5432
-- session mode — never 6543).

\echo '=== 0. server version (expect PostgreSQL 17.x) ==='
select version(), now();

\echo ''
\echo '=== 1. THE URGENT ONE: does report_areas.report_number exist? ==='
-- The deployed code SELECTs this column in /api/reports, report detail,
-- monitoring submit and /api/action-tasks. If is_identity is not YES/BY DEFAULT,
-- those screens are erroring for the live tenant right now.
select column_name, data_type, is_identity, identity_generation, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'report_areas' and column_name = 'report_number';
-- 0 rows  => column missing, core screens broken, apply migration 3 immediately.
-- is_identity = YES, identity_generation = BY DEFAULT => correct.
-- anything else => STOP. ADD COLUMN IF NOT EXISTS will skip silently and every
-- NIR insert will break later.

\echo ''
\echo '=== 2. which of the 9 olive tables already exist (expect 0 rows) ==='
select table_name from information_schema.tables
where table_schema = 'public' and table_name in (
  'parameters','parameter_rules','olive_plot_details','seasons',
  'yield_estimates','variety_windows','weather_days','nir_report','harvest_report')
order by table_name;

\echo ''
\echo '=== 3. crops named זית (expect 0 or exactly 1; >1 is a STOP) ==='
select id, name, description from crops where name = 'זית';

\echo ''
\echo '=== 4. customers — record the existing tenant id, never pass it to --customer ==='
select id, name, created_at from customers order by created_at;

\echo ''
\echo '=== 5. SECURITY DEFINER helpers the olive policies depend on ==='
-- All three must exist with prosecdef = true, or the new policies fail outright.
select proname, prosecdef from pg_proc
where proname in ('can_access_area','can_access_report_area','is_admin_user')
order by proname;

\echo ''
\echo '=== 6. uuid generation must work ==='
select uuid_generate_v4();

\echo ''
\echo '=== 7. the policy migration 2 will DROP (confirm it is there) ==='
-- So you know the drop in step 4 was real, and so rollback is meaningful.
select polname from pg_policy
where polrelid = 'public.areas'::regclass
order by polname;

\echo ''
\echo '=== 8. baseline counts — re-run these after the import ==='
select 'areas' t, count(*) from areas
union all select 'customers', count(*) from customers
union all select 'customer_areas', count(*) from customer_areas
union all select 'sub_areas', count(*) from sub_areas
union all select 'report_areas', count(*) from report_areas
union all select 'workers', count(*) from workers
order by t;

\echo ''
\echo '=== 9. which migration versions are already recorded ==='
select version from supabase_migrations.schema_migrations
where version in ('20260227000000','20260907000000','20260908000000',
                  '20260908100000','20260908110000','20260908120000','20260908140000')
order by version;
-- A version recorded here whose content never ran is exactly why `db push` is
-- wrong for this rollout: 20260227000000 was committed empty and back-filled.
