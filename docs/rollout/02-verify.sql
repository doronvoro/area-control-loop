-- Olive rollout — VERIFY. Read-only. Run straight after the migrations,
-- BEFORE the data import.
--
-- Running it before the import is about attribution: if the existing tenant
-- regresses here, it is unambiguously the RLS drop, not the import.
--
-- Pure SQL, one grid. Paste into Supabase Studio → SQL Editor.
-- Every row has an explicit want= so you are comparing, not interpreting.

select *
from (
  values
    -- schema ────────────────────────────────────────────────────────────────
    (0, 'olive tables',
     coalesce(
       (select count(*)::text || ' of 9 — ' || string_agg(table_name, ', ' order by table_name)
        from information_schema.tables
        where table_schema = 'public'
          and table_name in ('parameters','parameter_rules','olive_plot_details',
                             'seasons','yield_estimates','variety_windows',
                             'weather_days','nir_report','harvest_report')),
       '*** NONE ***'),
     'want: 9 of 9'),

    (1, 'report_areas.report_number',
     coalesce(
       (select 'is_identity=' || is_identity
               || ', generation=' || coalesce(identity_generation, '(none)')
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'report_areas'
          and column_name = 'report_number'),
       '*** MISSING ***'),
     'want: is_identity=YES, generation=BY DEFAULT'),

    -- seeded lookup data ────────────────────────────────────────────────────
    (2, 'parameters',
     (select count(*)::text from parameters),
     'want: 7'),

    (3, 'parameter_rules by parameter',
     coalesce(
       (select string_agg(parameter_code || '=' || n::text, ', ' order by parameter_code)
        from (select parameter_code, count(*) n from parameter_rules group by parameter_code) s),
       '*** NONE ***'),
     'want: dry=3, oil=3, water=4'),

    (4, 'report_area_types',
     coalesce(
       (select string_agg(name, ', ' order by name) from report_area_types),
       '*** NONE ***'),
     'want: action, harvest, monitoring, nir'),

    (5, 'crops named זית',
     (select count(*)::text from crops where name = 'זית'),
     'want: exactly 1 (create it if 0)'),

    -- the one change that touches the live tenant ───────────────────────────
    (6, 'recursion policy on areas',
     case
       when exists (select 1 from pg_policy
                    where polrelid = to_regclass('public.areas')
                      and polname = 'Users can view areas through report areas')
       then '*** STILL PRESENT — the RLS migration did not run ***'
       else 'gone (correct)'
     end,
     'want: gone'),

    (7, 'remaining policies on areas',
     coalesce(
       (select string_agg(polname, '  |  ' order by polname)
        from pg_policy where polrelid = to_regclass('public.areas')),
       '*** NONE — everything is locked out ***'),
     'want: "Users can view accessible areas" AND "Admins can view all areas" present'),

    -- nothing should have moved yet ─────────────────────────────────────────
    (8, 'baseline counts',
     (select 'areas=' || (select count(*) from areas)
          || '  customers=' || (select count(*) from customers)
          || '  customer_areas=' || (select count(*) from customer_areas)
          || '  sub_areas=' || (select count(*) from sub_areas)
          || '  report_areas=' || (select count(*) from report_areas)
          || '  workers=' || (select count(*) from workers)),
     'want: identical to 00-preflight — migrations add no rows here'),

    (9, 'olive data',
     (select 'plots=' || (select count(*) from olive_plot_details)
          || '  yield=' || (select count(*) from yield_estimates)
          || '  nir=' || (select count(*) from nir_report)
          || '  harvest=' || (select count(*) from harvest_report)
          || '  windows=' || (select count(*) from variety_windows)),
     'want: all 0 — the import has not run yet')
) as t(ord, check_name, result, want)
order by ord;


-- ============================================================================
-- THEN exercise the LIVE SITE, as the existing customer AND as one of their
-- workers. SQL cannot tell you this part.
--
--   /areas
--   /reports          <- area names must render, NOT "-"
--   open a report detail sheet
--   /actions
--   /map
--
-- These are exactly the surfaces the RLS migration changes. If area names go
-- blank, run SECTION A of 03-rollback.sql, stop, and re-plan the RLS fix.
-- Everything else can proceed independently.
-- ============================================================================
