-- Add "super_worker" worker type for workers who can do super_worker inspection and action work
INSERT INTO worker_types (name, display_name, description) VALUES
  ('super_worker', 'עובד על', 'Super worker - can perform all worker type tasks')
ON CONFLICT (name) DO NOTHING;

-- Update RLS policies on monitoring_area_report to allow 'super_worker' workers

DROP POLICY IF EXISTS "Inspectors can create monitoring reports" ON monitoring_area_report;
CREATE POLICY "Inspectors can create monitoring reports"
  ON monitoring_area_report FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workers
      JOIN worker_types ON worker_types.id = workers.type_id
      WHERE workers.user_id = auth.uid()
      AND worker_types.name IN ('inspector', 'super_worker')
    )
  );

DROP POLICY IF EXISTS "Inspectors can update monitoring reports" ON monitoring_area_report;
CREATE POLICY "Inspectors can update monitoring reports"
  ON monitoring_area_report FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workers
      JOIN worker_types ON worker_types.id = workers.type_id
      WHERE workers.user_id = auth.uid()
      AND worker_types.name IN ('inspector', 'super_worker')
    )
  );

-- Update RLS policies on actions_area_report to allow 'super_worker' workers

DROP POLICY IF EXISTS "Action workers can create action reports" ON actions_area_report;
CREATE POLICY "Action workers can create action reports"
  ON actions_area_report FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workers
      JOIN worker_types ON worker_types.id = workers.type_id
      WHERE workers.user_id = auth.uid()
      AND worker_types.name IN ('action_worker', 'super_worker')
    )
  );

DROP POLICY IF EXISTS "Action workers can update action reports" ON actions_area_report;
CREATE POLICY "Action workers can update action reports"
  ON actions_area_report FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workers
      JOIN worker_types ON worker_types.id = workers.type_id
      WHERE workers.user_id = auth.uid()
      AND worker_types.name IN ('action_worker', 'super_worker')
    )
  );
