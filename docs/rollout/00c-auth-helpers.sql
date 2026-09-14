-- Olive rollout — AUTH HELPER DEFINITIONS. Read-only. Run before the bundle.
--
-- WHY
-- Every RLS policy the olive migrations create delegates to these functions:
--   can_access_area          (4 policies)
--   can_access_report_area   (3 policies)
--   is_admin_user            (1 policy)
--
-- The pre-flight confirmed all three EXIST with prosecdef=true. It did not
-- confirm they mean the same thing they mean locally, and there is now concrete
-- reason to doubt it: production's "Users can view accessible areas" resolves
-- membership through get_user_customer_id(auth.uid()), while the version in this
-- repo uses a customers/workers join. Production's RLS has been reimplemented.
--
-- WHAT TO LOOK FOR in can_access_area specifically:
--   1. an admin branch                       -> admins keep working
--   2. a customer-owner branch               -> Noam sees his own plots
--   3. A WORKER BRANCH                       -> the workers Noam adds inherit
--                                               the plots
--
-- (3) is the one that matters and the one most likely to be missing. The whole
-- point of the Gashur tenant is that the owner adds workers who can then record
-- NIR readings. If can_access_area has no worker path, those workers will see
-- an empty plot list and every olive screen will look broken for them — while
-- working perfectly for Noam, so it will not show up in the owner's testing.
--
-- The local definition, for comparison:
--
--   SELECT is_admin_user(p_user_id)
--     OR EXISTS (
--       SELECT 1 FROM customer_areas ca
--       JOIN customers c ON c.id = ca.customer_id
--       WHERE ca.area_id = p_area_id
--         AND (c.user_id = p_user_id OR is_worker_in_customer(c.id, p_user_id))
--     );

select p.proname,
       pg_get_function_identity_arguments(p.oid) as args,
       p.prosecdef                                as security_definer,
       pg_get_functiondef(p.oid)                  as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where p.proname in ('can_access_area',
                    'can_access_report_area',
                    'is_admin_user',
                    'is_worker_in_customer',
                    'get_user_customer_id')
order by p.proname;

-- A function listed in the olive policies but MISSING from this result is a
-- stop condition: the CREATE POLICY statements will fail, and the bundle's
-- transaction will roll the whole thing back.
--
-- is_worker_in_customer missing while can_access_area references it would mean
-- the two databases have genuinely different authorization models, and the
-- olive RLS needs rewriting against production's before anything is applied.
