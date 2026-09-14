-- Admin tenant switching — PHASE 0 PROBE. Read-only.
--
-- Answers one question: does an admin have an RLS path to each tenant table on
-- THIS database? The answer decides whether the customer switcher can work, and
-- which Supabase client the scoped reads must use.
--
-- WHY THIS IS NOT OPTIONAL
-- All eight "Admins can view all X" policies come from ONE migration,
-- 20260125000000_fix_admin_rls_policies.sql. Production is known to be missing
-- the `areas` one (docs/rollout/README.md), which means either that migration
-- never applied — so the other seven are missing too — or the policies were
-- rewritten by hand. Nobody has checked the other seven.
--
-- Two of them are load-bearing for the switcher:
--   * customers      — GET /api/customers populates the dropdown through
--                      ctx.supabase. Missing => zero rows => EMPTY DROPDOWN,
--                      and the feature cannot bootstrap.
--   * customer_areas — getCustomerAreaIds reads it through ctx.supabase.
--                      Missing => [] after selecting => the admin picks a
--                      customer and still sees nothing.
--
-- Pure SQL, no psql meta-commands. Paste into Supabase Studio → SQL Editor.
-- Query 1 is the verdict and fits on a screen. Queries 2-4 are commented out;
-- run them one at a time only if query 1 shows something missing.

-- ── 1. THE VERDICT: does each tenant table have an admin SELECT path? ────────
select t.tbl,
       case
         when p.polname is not null then 'OK — ' || p.polname
         else '*** MISSING — admin cannot SELECT this table via RLS ***'
       end as admin_select_policy,
       case t.tbl
         when 'customers'      then 'LOAD-BEARING: missing => empty switcher dropdown'
         when 'customer_areas' then 'LOAD-BEARING: missing => nothing shows after picking'
         when 'areas'          then 'known missing in production'
         else ''
       end as note
from (values ('areas'), ('sub_areas'), ('customers'), ('customer_areas'),
             ('report_areas'), ('workers'), ('monitoring_area_report'),
             ('actions_area_report')) as t(tbl)
left join pg_policy p
       on p.polrelid = to_regclass('public.' || t.tbl)
      and p.polcmd = 'r'
      and pg_get_expr(p.polqual, p.polrelid) ilike '%is_admin_user%'
order by
  case t.tbl when 'customers' then 0 when 'customer_areas' then 1
             when 'areas' then 2 else 3 end,
  t.tbl;

-- Read the middle column. Every row should say OK.
--   customers or customer_areas MISSING => the scoped reads MUST use
--     adminClient; RLS cannot carry this feature. (This is the expected
--     outcome given what is already known about production.)
--   all eight OK => ctx.supabase is viable, though adminClient is still the
--     more robust choice since the app filters explicitly anyway.


-- ── 2. Who is an admin, and do they have the legacy all-areas customer row? ──
--
-- select u.email,
--        u.email_confirmed_at is not null as confirmed,
--        coalesce(c.name, '(none — correct)') as customer_row,
--        count(ca.area_id)                    as linked_areas
-- from user_roles ur
-- join roles r      on r.id = ur.role_id
-- join auth.users u on u.id = ur.user_id
-- left join customers c       on c.user_id = u.id
-- left join customer_areas ca on ca.customer_id = c.id
-- where r.name = 'admin'
-- group by u.email, u.email_confirmed_at, c.name
-- order by u.email;
--
-- 0 rows => there is no admin at all. Use 07-promote-admin.sql.
-- customer_row set with a high linked_areas count => that admin is really "a
--   customer who owns everything", the workaround the old create-admin script
--   created. It is what makes admin screens appear to work today.


-- ── 3. Role plumbing sanity ─────────────────────────────────────────────────
--
-- select r.name,
--        count(distinct rp.permission_id) as permissions,
--        count(distinct ur.user_id)       as users_holding_it
-- from roles r
-- left join role_permissions rp on rp.role_id = r.id
-- left join user_roles ur       on ur.role_id = r.id
-- group by r.name
-- order by r.name;
--
-- want: admin, customer_owner, worker.


-- ── 4. Full policy dump, only if you need to read the expressions ────────────
--
-- select polrelid::regclass::text as tbl, polname,
--        case polcmd when 'r' then 'SELECT' when 'a' then 'INSERT'
--                    when 'w' then 'UPDATE' when 'd' then 'DELETE'
--                    else 'ALL' end as cmd,
--        pg_get_expr(polqual, polrelid) as using_expr
-- from pg_policy
-- where polrelid in ('public.areas'::regclass, 'public.customer_areas'::regclass,
--                    'public.customers'::regclass, 'public.sub_areas'::regclass,
--                    'public.report_areas'::regclass, 'public.workers'::regclass,
--                    'public.monitoring_area_report'::regclass,
--                    'public.actions_area_report'::regclass)
-- order by tbl, polname;
