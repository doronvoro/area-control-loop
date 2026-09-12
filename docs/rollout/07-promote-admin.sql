-- Promote an existing user to admin. Writes one row.
--
-- HOW TO USE
--   1. The person signs up normally at /register, or is created through
--      /admin/customers or /admin/workers. They must be able to log in first.
--   2. Change 'CHANGE-ME@example.com' on the v_email line below (inside the DO
--      block, marked with an arrow) to their address.
--   3. Run. Re-running is safe.
--
-- Running it unedited fails with "Edit the v_email line at the top of the DO
-- block first". That is the guard, not a bug — promoting the wrong account is
-- not something to discover later.
--
-- WHY SQL AND NOT A SCRIPT
-- `npm run create-admin` does NOT create an admin. It writes
-- user_metadata.role = 'admin' and never inserts into user_roles — but
-- is_admin_user() and has_role() read ONLY user_roles:
--
--   SELECT EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
--                  WHERE ur.user_id = p_user_id AND r.name = 'admin');
--
-- So the script produces a user who looks like an admin in their JWT and is
-- redirected to /dashboard by every /admin/* page. user_metadata.role is read by
-- zero authorization paths in this codebase — it is decorative.
--
-- There is also no in-app way to CREATE an admin: /admin/roles can attach the
-- role to an existing user (POST /api/user-roles), but only an existing admin
-- can use it. Bootstrapping the first one is necessarily a SQL operation.
--
-- WHAT THIS DELIBERATELY DOES NOT DO
-- It does not create a `customers` row for the admin. scripts/create-admin-user.ts
-- does, and links it to every area, which is why an "admin" locally is really a
-- customer who owns everything. That workaround breaks tenancy reasoning and is
-- being replaced by the customer switcher. A real admin owns nothing.

-- Pure SQL, no psql meta-commands: this pastes into Supabase Studio as-is.
-- EDIT THE EMAIL ON THE v_email LINE BELOW. That is the only change needed.

BEGIN;

DO $$
DECLARE
  v_email   text := 'CHANGE-ME@example.com';   -- ◀── EDIT THIS
  v_user_id uuid;
  v_role_id uuid;
  v_existing int;
BEGIN
  IF v_email = 'CHANGE-ME@example.com' THEN
    RAISE EXCEPTION 'Edit the v_email line at the top of the DO block first';
  END IF;

  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower(v_email);
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION
      'No auth user with email %. They must sign up and log in once before being promoted.',
      v_email;
  END IF;

  SELECT id INTO v_role_id FROM public.roles WHERE name = 'admin';
  IF v_role_id IS NULL THEN
    RAISE EXCEPTION
      'No role named admin. Migration 006_roles_and_permissions.sql has not run on this database.';
  END IF;

  SELECT count(*) INTO v_existing
  FROM public.user_roles WHERE user_id = v_user_id AND role_id = v_role_id;

  IF v_existing > 0 THEN
    RAISE NOTICE '% is already an admin — nothing to do', v_email;
  ELSE
    INSERT INTO public.user_roles (user_id, role_id) VALUES (v_user_id, v_role_id);
    RAISE NOTICE 'promoted % to admin', v_email;
  END IF;

  -- Assert rather than trust: this is the exact check is_admin_user() performs.
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = v_user_id AND r.name = 'admin'
  ) THEN
    RAISE EXCEPTION 'promotion did not take effect for % — rolling back', v_email;
  END IF;
END $$;

COMMIT;


-- Verify (run separately, after COMMIT). Replace the email.
--
-- select u.email,
--        is_admin_user(u.id)                                as is_admin_now,
--        has_role(u.id, 'admin')                            as has_role_now,
--        (select count(*) from role_permissions rp
--         join roles r on r.id = rp.role_id where r.name='admin') as admin_permissions
-- from auth.users u
-- where lower(u.email) = lower('CHANGE-ME@example.com');
--
-- want: is_admin_now = true, has_role_now = true.
-- Both must be true — they are different functions (is_admin_user is
-- SECURITY DEFINER, has_role is not) and ctx.isAdmin uses has_role.


-- TO REVOKE
--
-- delete from public.user_roles ur
--  using public.roles r, auth.users u
--  where r.id = ur.role_id and u.id = ur.user_id
--    and r.name = 'admin' and lower(u.email) = lower('CHANGE-ME@example.com');
