-- Admin tenant switching — PHASE 0 PROBE. Read-only.
--
-- Answers one question: does an admin have any RLS path to the tenant tables on
-- THIS database? The answer decides whether the customer switcher can work at
-- all, and which Supabase client the scoped reads must use.
--
-- WHY THIS IS NOT OPTIONAL
-- All eight "Admins can view all X" policies come from ONE migration,
-- 20260125000000_fix_admin_rls_policies.sql. Production is known to be missing
-- the `areas` one (docs/rollout/README.md), which means either that migration
-- never applied — so the other seven are missing too — or the policies were
-- rewritten by hand. Nobody has checked the other seven.
--
-- Two of them are load-bearing for this feature:
--   * "Admins can view all customers"      — GET /api/customers populates the
--     switcher through ctx.supabase. Missing => zero rows => empty dropdown =>
--     the feature cannot bootstrap.
--   * "Admins can view all customer areas" — getCustomerAreaIds reads
--     customer_areas through ctx.supabase. Missing => [] after selecting =>
--     the admin picks a customer and still sees nothing.
--
-- Pure SQL, one grid per statement. Paste into Supabase Studio → SQL Editor.

-- ── 1. Which admin policies exist, on all eight tenant tables ────────────────
select polrelid::regclass::text            as tbl,
       polname,
       case polcmd when 'r' then 'SELECT' when 'a' then 'INSERT'
                   when 'w' then 'UPDATE' when 'd' then 'DELETE'
                   else 'ALL' end          as cmd,
       pg_get_expr(polqual, polrelid)      as using_expr
from pg_policy
where polrelid in ('public.areas'::regclass,
                   'public.customer_areas'::regclass,
                   'public.customers'::regclass,
                   'public.sub_areas'::regclass,
                   'public.report_areas'::regclass,
                   'public.workers'::regclass,
                   'public.monitoring_area_report'::regclass,
                   'public.actions_area_report'::regclass)
order by tbl, polname;

-- Look for a policy whose using_expr is exactly `is_admin_user(auth.uid())` on
-- each table. Note which of the eight are present. Anything missing on
-- `customers` or `customer_areas` forces the adminClient design.


-- ── 2. Who is an admin today, and do they have a customers row? ──────────────
-- Run separately.
--
-- select u.email,
--        u.email_confirmed_at is not null as confirmed,
--        c.name                           as customer_row,
--        count(ca.area_id)                as linked_areas
-- from user_roles ur
-- join roles r      on r.id = ur.role_id
-- join auth.users u on u.id = ur.user_id
-- left join customers c       on c.user_id = u.id
-- left join customer_areas ca on ca.customer_id = c.id
-- where r.name = 'admin'
-- group by u.email, u.email_confirmed_at, c.name
-- order by u.email;
--
-- 0 rows  => there is no admin at all. Use 06-promote-admin.sql.
-- customer_row NOT null with a high linked_areas count => this admin is really
--   "a customer who owns everything", the workaround scripts/create-admin-user.ts
--   creates. It is what makes admin screens appear to work; it is not how admin
--   is supposed to work, and the switcher replaces it.


-- ── 3. Sanity: the role and permission plumbing ──────────────────────────────
-- Run separately.
--
-- select r.name,
--        count(rp.permission_id) as permissions,
--        count(ur.user_id)       as users_holding_it
-- from roles r
-- left join role_permissions rp on rp.role_id = r.id
-- left join user_roles ur       on ur.role_id = r.id
-- group by r.name
-- order by r.name;
--
-- want: admin, customer_owner, worker. If `admin` has 0 users, see step 2.
