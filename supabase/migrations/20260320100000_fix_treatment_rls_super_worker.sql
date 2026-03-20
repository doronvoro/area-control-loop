-- Fix RLS policies on action_treatments and monitoring_treatments to support super_worker
-- and add a read policy for action_treatments so all workers in the same customer can view them

-- 1) Update action_treatments: allow super_worker to manage
DROP POLICY IF EXISTS "Action workers can manage action treatments" ON action_treatments;
CREATE POLICY "Action workers can manage action treatments"
  ON action_treatments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM workers
      JOIN worker_types ON worker_types.id = workers.type_id
      WHERE workers.user_id = auth.uid()
      AND worker_types.name IN ('action_worker', 'super_worker')
    )
  );

-- 2) Add read policy for action_treatments (similar to monitoring_treatments)
-- so any worker/customer user can view treatments for reports in their areas
DROP POLICY IF EXISTS "Users can view action treatments for their areas" ON action_treatments;
CREATE POLICY "Users can view action treatments for their areas"
  ON action_treatments FOR SELECT
  USING (
    is_admin_user(auth.uid()) OR
    EXISTS (
      SELECT 1
      FROM actions_area_report aar
      JOIN report_areas ra ON ra.id = aar.area_report_id
      JOIN customer_areas ca ON ca.area_id = ra.area_id
      WHERE aar.id = action_treatments.action_report_id
      AND (
        EXISTS (SELECT 1 FROM customers WHERE customers.id = ca.customer_id AND customers.user_id = auth.uid())
        OR EXISTS (SELECT 1 FROM workers WHERE workers.customer_id = ca.customer_id AND workers.user_id = auth.uid())
      )
    )
  );

-- 3) Update monitoring_treatments: allow super_worker to manage
DROP POLICY IF EXISTS "Inspectors can manage monitoring treatments" ON monitoring_treatments;
CREATE POLICY "Inspectors can manage monitoring treatments"
  ON monitoring_treatments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM workers
      JOIN worker_types ON worker_types.id = workers.type_id
      WHERE workers.user_id = auth.uid()
      AND worker_types.name IN ('inspector', 'super_worker')
    )
  );
