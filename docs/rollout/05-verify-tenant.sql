-- Olive rollout — VERIFY THE גשור TENANT. Read-only.
-- Run after creating the customer in /admin/customers, before the import.
--
-- One grid, explicit want= on every row.
--
-- The thing this is really checking is that Noam can add workers WITHOUT
-- further intervention. That depends on three separate facts, and it is worth
-- confirming all three rather than discovering at handover that one is missing:
--   1. the auth user exists and is confirmed (he can log in at all)
--   2. the customer_owner role is attached to that user
--   3. the customer_owner role actually grants create_worker on THIS database
--      (production's role grants have not been verified, and production has
--      diverged from this repo in every other respect checked so far)

select *
from (
  values
    (0, 'customer row',
     coalesce(
       (select 'id=' || id::text || '  user_id=' || coalesce(user_id::text, '(NULL)')
        from customers where name = 'קיבוץ גשור'),
       '*** not found — check the exact name, it must match ***'),
     'want: one row, user_id NOT null'),

    (1, 'auth user',
     coalesce(
       (select 'email=' || u.email
               || '  confirmed=' || case when u.email_confirmed_at is null then 'NO' else 'yes' end
               || '  last_sign_in=' || coalesce(u.last_sign_in_at::text, 'never')
        from auth.users u
        join customers c on c.user_id = u.id
        where c.name = 'קיבוץ גשור'),
       '*** no auth user linked to the customer ***'),
     'want: noamwaiz1985@gmail.com, confirmed=yes'),

    (2, 'roles on that user',
     coalesce(
       (select string_agg(r.name, ', ' order by r.name)
        from customers c
        join user_roles ur on ur.user_id = c.user_id
        join roles r on r.id = ur.role_id
        where c.name = 'קיבוץ גשור'),
       '*** no role attached — he will be redirected to /dashboard ***'),
     'want: customer_owner'),

    (3, 'can customer_owner manage workers here',
     coalesce(
       (select string_agg(p.name, ', ' order by p.name)
        from roles r
        join role_permissions rp on rp.role_id = r.id
        join permissions p on p.id = rp.permission_id
        where r.name = 'customer_owner'
          and p.name in ('create_worker','read_worker','update_worker','delete_worker')),
       '*** none — /admin/workers will render read-only or redirect ***'),
     'want: create_worker, delete_worker, read_worker, update_worker'),

    (4, 'can customer_owner manage areas here',
     coalesce(
       (select string_agg(p.name, ', ' order by p.name)
        from roles r
        join role_permissions rp on rp.role_id = r.id
        join permissions p on p.id = rp.permission_id
        where r.name = 'customer_owner'
          and p.name in ('create_area','update_area','read_area','add_area_to_customer')),
       '*** none ***'),
     'want: add_area_to_customer, create_area, read_area, update_area'),

    (5, 'areas already linked to גשור',
     coalesce(
       (select count(*)::text
        from customer_areas ca
        join customers c on c.id = ca.customer_id
        where c.name = 'קיבוץ גשור'),
       '0'),
     'want: 0 before the import, 45 after'),

    (6, 'olive crop',
     coalesce(
       (select count(*)::text || ' — id=' || string_agg(id::text, ', ')
        from crops where name = 'זית'),
       '0'),
     'want: exactly 1'),

    (7, 'tenant isolation: olive areas on any OTHER customer',
     coalesce(
       (select string_agg(c.name || '=' || n::text, ', ')
        from (
          select c2.name, count(*) n
          from areas a
          join crops cr on cr.id = a.crop_id
          join customer_areas ca on ca.area_id = a.id
          join customers c2 on c2.id = ca.customer_id
          where cr.name = 'זית' and c2.name <> 'קיבוץ גשור'
          group by c2.name
        ) s(name, n)
        join customers c on c.name = s.name),
       'none'),
     'want: none — olive plots must not reach the other three tenants')
) as t(ord, check_name, result, want)
order by ord;


-- If row 3 comes back empty, do NOT hand the site over. Grant the missing
-- permissions to the customer_owner role rather than giving Noam the admin role:
--
-- insert into role_permissions (role_id, permission_id)
-- select r.id, p.id from roles r, permissions p
-- where r.name = 'customer_owner'
--   and p.name in ('create_worker','read_worker','update_worker','delete_worker')
-- on conflict do nothing;
