-- Olive rollout — FOLLOW-UP diagnostics. Read-only.
--
-- Run after 00-preflight.sql. These questions only became relevant once the
-- pre-flight showed that production's schema has diverged from this repo's
-- migration history:
--
--   * report_areas.report_number exists but is NOT an identity column, and no
--     migration in this repo creates it that way — so it was added by hand.
--   * "Users can view areas through report areas" is absent, though
--     20260214000000 creates it.
--   * "Admins can view all areas" is absent, though 20260124193135 and
--     20260125000000 both create it.
--   * Production has policies ("Admins and customer owners can create areas",
--     "Customer owners can delete their areas", ...) that NO migration here
--     produces.
--
-- So the ledger cannot be trusted, and neither can "the migration ran" as a
-- proxy for "the schema is right". These queries establish what is actually
-- there before anything is applied.

select *
from (
  values
    -- 1 ── report_number: is it usable as a report number today? ────────────
    (0, 'report_areas rows / numbered / null',
     (select count(*)::text || ' rows, '
          || count(report_number)::text || ' numbered, '
          || count(*) filter (where report_number is null)::text || ' NULL'
      from report_areas),
     'NULLs mean new reports are already getting no number'),

    (1, 'report_number range',
     coalesce(
       (select 'min=' || min(report_number)::text || ' max=' || max(report_number)::text
        from report_areas where report_number is not null),
       '(all null)'),
     'the fix restarts the sequence above max'),

    (2, 'report_number duplicates',
     coalesce(
       (select string_agg(report_number::text || ' x' || n::text, ', ')
        from (select report_number, count(*) n from report_areas
              where report_number is not null
              group by report_number having count(*) > 1) d),
       'none'),
     'duplicates must be resolved before a UNIQUE/identity is trusted'),

    (3, 'report_number default',
     coalesce(
       (select coalesce(column_default, '(no default)')
        from information_schema.columns
        where table_schema='public' and table_name='report_areas'
          and column_name='report_number'),
       '(column missing)'),
     'a leftover default must be dropped before ADD GENERATED'),

    -- 2 ── can admins still see areas? ──────────────────────────────────────
    (4, 'SELECT policies on areas',
     coalesce(
       (select string_agg(polname || ' => ' || pg_get_expr(polqual, polrelid), '   ||   ')
        from pg_policy
        where polrelid = to_regclass('public.areas') and polcmd = 'r'),
       '*** none ***'),
     'check an admin path exists — "Admins can view all areas" is absent'),

    -- 3 ── report types already defined ─────────────────────────────────────
    (5, 'report_area_types',
     coalesce((select string_agg(name, ', ' order by name) from report_area_types), '(none)'),
     'want action, monitoring now; nir, harvest get added'),

    -- 4 ── does report_areas already carry anything olive? ──────────────────
    (6, 'report_areas.area_type_id values in use',
     coalesce(
       (select string_agg(coalesce(area_type_id,'(null)') || ' x' || n::text, ', ')
        from (select area_type_id, count(*) n from report_areas group by area_type_id) s),
       '(no rows)'),
     'sanity check on existing report data')
) as t(ord, check_name, result, note)
order by ord;


-- ============================================================================
-- Run these two SEPARATELY (each can fail on its own without hiding the rest).
-- ============================================================================

-- A. Migration ledger — how much of this repo's history does production claim?
--
-- select count(*) as total_recorded,
--        min(version) as earliest,
--        max(version) as latest
-- from supabase_migrations.schema_migrations;

-- B. Which of the 7 are already recorded (expect none of the six olive ones):
--
-- select version
-- from supabase_migrations.schema_migrations
-- where version in ('20260124193135','20260125000000','20260214000000',
--                   '20260227000000','20260907000000','20260908000000',
--                   '20260908100000','20260908110000','20260908120000',
--                   '20260908140000')
-- order by version;
--
-- The first three are the interesting ones: if they ARE recorded but their
-- policies are absent, production was edited by hand after they ran, and the
-- ledger is decorative.
