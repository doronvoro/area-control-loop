-- Olive rollout — PRE-FLIGHT. Read-only. Run this first and keep the output.
--
-- It is the before-picture, half the rollback plan, and the fastest answer to
-- "is production broken right now?". Nothing here writes.
--
-- Pure SQL, no psql meta-commands: paste into Supabase Studio → SQL Editor.
-- Everything comes back as ONE grid, because Studio shows only the last result
-- set when a script contains several statements.
--
-- If you prefer psql, use the pooler on port 5432 (session mode), never 6543.

select *
from (
  values
    -- 0 ────────────────────────────────────────────────────────────────────
    (0, 'server version', version()),

    (1, 'now()', now()::text),

    -- 1 ── THE URGENT ONE ───────────────────────────────────────────────────
    -- The deployed code SELECTs report_number in /api/reports, report detail,
    -- monitoring submit and /api/action-tasks. Missing => those screens are
    -- erroring for the live tenant right now.
    (2, 'report_areas.report_number',
     coalesce(
       (select 'EXISTS — type=' || data_type
               || ', is_identity=' || is_identity
               || ', generation=' || coalesce(identity_generation, '(none)')
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'report_areas'
          and column_name = 'report_number'),
       '*** MISSING — core screens broken, apply the migrations now ***')),
    -- Want: is_identity=YES, generation=BY DEFAULT.
    -- Present in any OTHER shape => STOP: ADD COLUMN IF NOT EXISTS will skip
    -- silently and every NIR insert breaks later.

    -- 2 ── olive tables (expect none before the rollout) ────────────────────
    (3, 'olive tables already present',
     coalesce(
       (select string_agg(table_name, ', ' order by table_name)
        from information_schema.tables
        where table_schema = 'public'
          and table_name in ('parameters','parameter_rules','olive_plot_details',
                             'seasons','yield_estimates','variety_windows',
                             'weather_days','nir_report','harvest_report')),
       '(none — as expected)')),

    -- 3 ── crop (0 or exactly 1; more than 1 is a STOP) ─────────────────────
    (4, 'crops named זית',
     coalesce(
       (select count(*)::text || ' — ids: ' || string_agg(id::text, ', ')
        from crops where name = 'זית'),
       '0')),

    -- 4 ── tenants. Record the existing id; never pass it to --customer. ────
    (5, 'customers',
     coalesce(
       (select string_agg(name || ' = ' || id::text, '  |  ' order by created_at)
        from customers),
       '(none)')),

    -- 5 ── SECURITY DEFINER helpers the olive policies depend on ────────────
    (6, 'auth helper functions',
     coalesce(
       (select string_agg(proname || ' (secdef=' || prosecdef::text || ')', ', ' order by proname)
        from pg_proc
        where proname in ('can_access_area','can_access_report_area','is_admin_user')),
       '*** NONE FOUND — the olive policies will fail ***')),
    -- All three must be listed, each with secdef=true.

    -- 6 ── uuid generation. Checks the extension rather than calling the
    --      function, so a missing extension reports instead of aborting.
    (7, 'uuid-ossp extension',
     coalesce(
       (select 'installed v' || extversion from pg_extension where extname = 'uuid-ossp'),
       '*** NOT INSTALLED ***')),

    -- 7 ── the policy the RLS migration will DROP ───────────────────────────
    (8, 'policies on areas',
     coalesce(
       (select string_agg(polname, '  |  ' order by polname)
        from pg_policy where polrelid = to_regclass('public.areas')),
       '(none)')),
    -- "Users can view areas through report areas" should be listed now and
    -- gone after. If it is already absent, the RLS migration is a no-op.

    -- 8 ── baseline counts. Re-run after the import and compare. ────────────
    (9, 'baseline counts',
     (select 'areas=' || (select count(*) from areas)
          || '  customers=' || (select count(*) from customers)
          || '  customer_areas=' || (select count(*) from customer_areas)
          || '  sub_areas=' || (select count(*) from sub_areas)
          || '  report_areas=' || (select count(*) from report_areas)
          || '  workers=' || (select count(*) from workers)))
) as t(ord, check_name, result)
order by ord;


-- ============================================================================
-- 9 ── migration ledger. SEPARATE STATEMENT on purpose: if the
--      supabase_migrations schema is not readable, this fails alone instead of
--      taking the whole pre-flight with it. Run it after the grid above.
--
--      A version recorded here whose content never ran is exactly why
--      `supabase db push` is wrong for this rollout: 20260227000000 was
--      committed empty and back-filled later.
-- ============================================================================

-- select version
-- from supabase_migrations.schema_migrations
-- where version in ('20260227000000','20260907000000','20260908000000',
--                   '20260908100000','20260908110000','20260908120000',
--                   '20260908140000')
-- order by version;
